import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
let put: any, Document: any, Packer: any, Paragraph: any, TextRun: any, HeadingLevel: any

const initializeModules = async () => {
  try {
    const blobModule = await import("@vercel/blob")
    put = blobModule.put
  } catch (error) {
    put = async () => ({ url: "" })
  }

  try {
    const docxModule = await import("docx")
    Document = docxModule.Document
    Packer = docxModule.Packer
    Paragraph = docxModule.Paragraph
    TextRun = docxModule.TextRun
    HeadingLevel = docxModule.HeadingLevel
  } catch (error) {
    Document = class {
      constructor() {}
    }
    Packer = { toBuffer: async () => Buffer.from("") }
    Paragraph = class {
      constructor() {}
    }
    TextRun = class {
      constructor() {}
    }
    HeadingLevel = { TITLE: 0, HEADING_1: 1, HEADING_2: 2 }
  }
}

export async function POST(request: NextRequest) {
  await initializeModules()

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user

    const rateLimitResult = await applyRateLimit(request, user?.id, "ai_summarize")
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many summarization requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            ...rateLimitResult.headers,
          },
        },
      )
    }

    const requestBody = await request.json()
    const { noteId, tone = "formal", replies: providedReplies, isTeamNote, generateDocx = false } = requestBody

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    if (!process.env.XAI_API_KEY || process.env.XAI_API_KEY.trim() === "") {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    let replies: any[] = []
    let userIds: string[] = []

    if (providedReplies && Array.isArray(providedReplies)) {
      replies = providedReplies.map((reply: any, index: number) => ({
        id: `reply-${index}`,
        content: reply.content,
        created_at: reply.created_at || new Date().toISOString(),
        user_id: "team-user",
        user: reply.user || "User",
      }))
    } else if (isTeamNote) {
      const { data: fetchedReplies, error } = await supabase
        .from("team_note_replies")
        .select(`
          id, content, created_at, updated_at, user_id,
          user:users(username, email)
        `)
        .eq("team_note_id", noteId)
        .order("created_at", { ascending: true })

      if (error) {
        return NextResponse.json({ error: "Failed to fetch team note replies" }, { status: 500 })
      }

      replies = fetchedReplies || []
    } else {
      const { data: fetchedReplies, error } = await supabase
        .from("personal_sticks_replies")
        .select("id, content, created_at, updated_at, user_id")
        .eq("personal_stick_id", noteId)
        .order("created_at", { ascending: true })

      if (error) {
        return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
      }

      replies = fetchedReplies || []
      userIds = [...new Set(replies.map((reply) => reply.user_id))]
    }

    if (!replies || replies.length === 0) {
      return NextResponse.json({ summary: "No replies to summarize." })
    }

    // Fetch user data if we have user IDs
    let userMap = new Map()
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, email")
        .in("id", userIds)

      if (usersError) {
        return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 })
      }

      userMap = new Map(users?.map((user) => [user.id, user]) || [])
    }

    // Format replies for summarization
    const repliesText = replies
      .map((reply, index) => {
        const user = reply.user || userMap.get(reply.user_id)
        const author = user?.username || user?.email || user || "Anonymous"
        const timestamp = new Date(reply.created_at).toLocaleDateString()
        return `Reply ${index + 1} by ${author} (${timestamp}):\n${reply.content}`
      })
      .join("\n\n")

    const getTonePrompt = (selectedTone: string) => {
      const toneInstructions = {
        cinematic:
          "Write this summary as if it were a movie script scene description. Use dramatic language, visual imagery, and narrative flow. Focus on the emotional arc and character dynamics.",
        formal:
          "Provide a professional, structured summary suitable for a business report. Use clear, objective language and organize key points logically.",
        casual:
          "Write this summary in a conversational, friendly tone as if explaining to a friend. Use everyday language and focus on the main takeaways.",
        dramatic:
          "Write this summary as a compelling narrative with rich descriptions and emotional depth, like a chapter from a novel. Emphasize the human elements and story arc.",
      }
      return toneInstructions[selectedTone as keyof typeof toneInstructions] || toneInstructions.formal
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4",
        messages: [
          {
            role: "user",
            content: `${getTonePrompt(tone)}

Please summarize the following replies to a note:

${repliesText}

Summary:`,
          },
        ],
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary"

    if (generateDocx) {
      const summaryParagraphs = summary
        .split(/\n\n+/)
        .filter((paragraph: string) => paragraph.trim().length > 0)
        .map((paragraph: string) => paragraph.trim())

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "REPLY SUMMARY",
                heading: HeadingLevel.TITLE,
                spacing: { after: 400 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Generated on ${new Date().toLocaleDateString()} | Tone: ${tone.charAt(0).toUpperCase() + tone.slice(1)} | ${replies.length} Replies`,
                    italics: true,
                    size: 20,
                  }),
                ],
                spacing: { after: 600 },
              }),
              new Paragraph({
                text: "SUMMARY",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              ...summaryParagraphs.map(
                (paragraphText: string) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: paragraphText,
                        size: 24,
                      }),
                    ],
                    spacing: { after: 300 },
                  }),
              ),
              new Paragraph({
                text: "ORIGINAL REPLIES",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              ...replies.flatMap((reply) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${reply.user?.username || reply.user?.email || reply.user || "Anonymous"}`,
                      bold: true,
                      size: 26,
                    }),
                    new TextRun({
                      text: ` (${new Date(reply.created_at).toLocaleDateString()})`,
                      italics: true,
                      size: 22,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: reply.content,
                      size: 24,
                    }),
                  ],
                  spacing: { after: 400 },
                }),
              ]),
            ],
          },
        ],
      })

      const buffer = await Packer.toBuffer(doc)
      const docxBlob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })

      const filename = `reply-summary-${noteId}-${Date.now()}.docx`
      const blob = await put(filename, docxBlob, {
        access: "public",
      })

      try {
        const cleanupResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/cleanup-docx`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              blobUrl: blob.url,
              filename: filename,
            }),
          },
        )

        if (cleanupResponse.ok) {
          const cleanupResult = await cleanupResponse.json()
          return NextResponse.json({
            summary,
            replyCount: replies.length,
            tone,
            docxUrl: cleanupResult.cleanedUrl,
            filename,
          })
        }
      } catch (cleanupError) {
        // Fall back to original document if cleanup fails
      }

      return NextResponse.json({
        summary,
        replyCount: replies.length,
        tone,
        docxUrl: blob.url,
        filename,
      })
    }

    return NextResponse.json({
      summary,
      replyCount: replies.length,
      tone,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}

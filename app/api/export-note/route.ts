import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import type { DatabaseClient } from "@/lib/database/database-adapter"
import { generateText as aiGenerateText, isAIAvailable } from "@/lib/ai/ai-provider"

interface ExportLink {
  url: string
  filename: string
  created_at: string
  type: string
}

interface ExportData {
  exports?: ExportLink[]
  [key: string]: unknown
}

interface TabData {
  videos?: Array<{ title?: string; url?: string; embed_url?: string }>
  images?: Array<{ caption?: string; url?: string }>
}

import { put } from "@/lib/storage/local-storage"

// Dynamic module references for docx only (AI now uses unified provider)
let Document: typeof import("docx").Document | undefined
let Packer: typeof import("docx").Packer | undefined
let Paragraph: typeof import("docx").Paragraph | undefined
let TextRun: typeof import("docx").TextRun | undefined
let HeadingLevel: typeof import("docx").HeadingLevel | undefined

const initializeModules = async () => {

  try {
    const docxModule = await import("docx")
    Document = docxModule.Document
    Packer = docxModule.Packer
    Paragraph = docxModule.Paragraph
    TextRun = docxModule.TextRun
    HeadingLevel = docxModule.HeadingLevel
  } catch (error) {
    console.warn("docx module not available:", error instanceof Error ? error.message : String(error))
  }
}

function parseTabData(tabData: unknown): TabData {
  try {
    let data = tabData

    // Handle corrupted tab_data stored as individual characters (object with numeric keys)
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const keys = Object.keys(data)
      if (keys.length > 0 && keys.every((key) => !Number.isNaN(Number(key)))) {
        const sortedKeys = keys.toSorted((a, b) => Number(a) - Number(b))
        const jsonString = sortedKeys.map((key) => (data as Record<string, string>)[key]).join("")
        data = JSON.parse(jsonString)
      }
    } else if (typeof data === "string") {
      data = JSON.parse(data)
    }

    return data as TabData
  } catch {
    return {}
  }
}

function getTonePrompt(tone: string): string {
  const toneInstructions: Record<string, string> = {
    cinematic:
      "Write this summary as if it were a movie script scene description. Use dramatic language, visual imagery, and narrative flow. Focus on the emotional arc and character dynamics. Structure with clear paragraph breaks for different scenes or themes.",
    formal:
      "Provide a professional, structured summary suitable for a business report. Use clear, objective language and organize key points logically with distinct paragraphs for different topics.",
    casual:
      "Write this summary in a conversational, friendly tone as if explaining to a friend. Use everyday language and focus on the main takeaways. Break into natural conversation paragraphs.",
    dramatic:
      "Write this summary as a compelling narrative with rich descriptions and emotional depth, like a chapter from a novel. Emphasize the human elements and story arc with clear paragraph breaks for different narrative elements.",
  }
  return toneInstructions[tone] || toneInstructions.formal
}

// Helper functions to avoid nested template literals
function formatVideoLink(v: { title?: string; embed_url?: string; url?: string }): string {
  const title = v.title || "Untitled"
  const url = v.embed_url || v.url || ""
  return `${title} (${url})`
}

function formatImageLink(i: { caption?: string; url?: string }): string {
  const caption = i.caption || "Untitled"
  return `${caption} (${i.url || ""})`
}

function formatTag(t: { tag_content: string; tag_title?: string }): string {
  const suffix = t.tag_title ? ` (${t.tag_title})` : ""
  return `- ${t.tag_content}${suffix}`
}

function formatReply(r: { user?: { username?: string; email?: string }; created_at: string; content: string }): string {
  const userName = r.user?.username || r.user?.email || "User"
  const date = new Date(r.created_at).toLocaleDateString()
  return `- ${userName} (${date}): ${r.content}`
}

async function saveExportLink(
  db: DatabaseClient,
  noteId: string,
  userId: string,
  exportLink: ExportLink,
): Promise<void> {
  const { data: existingDetailsTab } = await db
    .from("personal_sticks_tabs")
    .select("*")
    .eq("personal_stick_id", noteId)
    .eq("tab_type", "details")
    .single()

  if (existingDetailsTab) {
    let currentData: ExportData = {}
    try {
      if (typeof existingDetailsTab.tab_data === "string") {
        currentData = JSON.parse(existingDetailsTab.tab_data)
      } else if (existingDetailsTab.tab_data && typeof existingDetailsTab.tab_data === "object") {
        currentData = existingDetailsTab.tab_data as ExportData
      }
    } catch {
      currentData = {}
    }

    const updatedExports = [...(currentData.exports || []), exportLink]
    const newTabData = { ...currentData, exports: updatedExports }

    await db
      .from("personal_sticks_tabs")
      .update({
        tab_data: newTabData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDetailsTab.id)
  } else {
    await db.from("personal_sticks_tabs").insert({
      personal_stick_id: noteId,
      user_id: userId,
      tab_type: "details",
      tab_name: "Details",
      tab_content: "Note details and exports",
      tab_data: { exports: [exportLink] },
      tab_order: 3,
    })
  }
}

function buildExportPrompt(
  tone: string,
  noteData: { topic?: string; content?: string; details?: string; created_at: string; updated_at?: string },
  videoLinks: Array<{ title?: string; embed_url?: string; url?: string }>,
  imageLinks: Array<{ caption?: string; url?: string }>,
  tags: Array<{ tag_content: string; tag_title?: string }>,
  replies: Array<{ user?: { username?: string; email?: string }; created_at: string; content: string }>,
): string {
  const lineBreakInstruction = "double line breaks between different topics"
  const createdDate = new Date(noteData.created_at).toLocaleDateString()
  const updatedDate = noteData.updated_at ? new Date(noteData.updated_at).toLocaleDateString() : "Never"

  const videoSection =
    videoLinks.length > 0
      ? `- Video Links (${videoLinks.length}): ${videoLinks.map(formatVideoLink).join(", ")}`
      : "- No video content"

  const imageSection =
    imageLinks.length > 0
      ? `- Image Links (${imageLinks.length}): ${imageLinks.map(formatImageLink).join(", ")}`
      : "- No image content"

  const tagsSection = tags.length > 0 ? tags.map(formatTag).join("\n") : "- No tags generated"

  const repliesSection = replies.length > 0 ? replies.map(formatReply).join("\n") : "- No replies yet"

  return `${getTonePrompt(tone)}

Please create a comprehensive summary of this note with all its components. Structure your response with clear paragraph breaks using ${lineBreakInstruction}:

**Note Information:**
- Topic: ${noteData.topic || "Untitled"}
- Content: ${noteData.content || "No content"}
- Details: ${noteData.details || "No additional details"}
- Created: ${createdDate}
- Updated: ${updatedDate}

**Media Content:**
${videoSection}
${imageSection}

**Generated Tags:**
${tagsSection}

**Replies and Discussion (${replies.length} replies):**
${repliesSection}

Please provide a well-structured, comprehensive summary that captures all aspects of this note. Use clear paragraph breaks to separate different topics and themes. Format it as a professional document that could serve as a complete record of this note's content and discussion.`
}

export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  await initializeModules()

  try {
    const { noteId, tone = "formal" } = await request.json()

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI service not available" }, { status: 500 })
    }

    if (!Document || !Paragraph || !TextRun || !HeadingLevel || !Packer) {
      return NextResponse.json({ error: "Document export modules not available" }, { status: 500 })
    }

    const DocClass = Document
    const ParagraphClass = Paragraph
    const TextRunClass = TextRun
    const HeadingLevelEnum = HeadingLevel
    const PackerClass = Packer

    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    // Fetch note data
    const { data: noteData, error: noteError } = await db
      .from("personal_sticks")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single()

    if (noteError || !noteData) {
      return NextResponse.json({ error: "Note not found or access denied" }, { status: 404 })
    }

    // Fetch replies
    const { data: repliesData } = await db
      .from("personal_sticks_replies")
      .select("*")
      .eq("personal_stick_id", noteId)
      .order("created_at", { ascending: true })

    // Fetch user data for replies separately
    const replyUserIds = [...new Set((repliesData || []).map((r: any) => r.user_id).filter(Boolean))]
    let userMap = new Map<string, { username: string; email: string }>()
    if (replyUserIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, username, email")
        .in("id", replyUserIds)
      for (const u of users || []) {
        userMap.set(u.id, { username: u.username, email: u.email })
      }
    }

    const replies = (repliesData || []).map((r: any) => ({
      ...r,
      user: r.user_id ? userMap.get(r.user_id) || null : null,
    }))

    // Fetch tabs
    const { data: tabsData } = await db
      .from("personal_sticks_tabs")
      .select("*")
      .eq("personal_stick_id", noteId)
      .order("tab_order", { ascending: true })

    const noteTabs = tabsData || []

    const videoLinks = noteTabs
      .filter((tab) => tab.tab_type === "video")
      .flatMap((tab) => {
        const data = parseTabData(tab.tab_data)
        return (data.videos || []).map((video) => ({
          ...video,
          embed_url: video.embed_url || video.url,
        }))
      })

    const imageLinks = noteTabs
      .filter((tab) => tab.tab_type === "images")
      .flatMap((tab) => {
        const data = parseTabData(tab.tab_data)
        return data.images || []
      })

    // Fetch tags
    const { data: tagsData } = await db
      .from("personal_sticks_tags")
      .select("tag_content, tag_title")
      .eq("personal_stick_id", noteId)

    const tags = tagsData || []

    const prompt = buildExportPrompt(tone, noteData, videoLinks, imageLinks, tags, replies)

    // Generate AI summary
    const { text: comprehensiveSummary } = await aiGenerateText({
      prompt,
      maxTokens: 2000,
    })

    // Build DOCX document
    const summaryParagraphs = comprehensiveSummary
      .split(/\n\n+/)
      .filter((p: string) => p.trim().length > 0)
      .map((p: string) => p.trim())

    const doc = new DocClass({
      sections: [
        {
          children: [
            new ParagraphClass({
              text: "COMPREHENSIVE NOTE EXPORT",
              heading: HeadingLevelEnum.TITLE,
              spacing: { after: 400 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Tone: ${tone.charAt(0).toUpperCase() + tone.slice(1)}`,
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 600 },
            }),
            new ParagraphClass({
              text: "EXECUTIVE SUMMARY",
              heading: HeadingLevelEnum.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...summaryParagraphs.map(
              (paragraphText: string) =>
                new ParagraphClass({
                  children: [new TextRunClass({ text: paragraphText, size: 24 })],
                  spacing: { after: 300 },
                }),
            ),
            new ParagraphClass({
              text: "NOTE INFORMATION",
              heading: HeadingLevelEnum.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({ text: "Topic: ", bold: true, size: 24 }),
                new TextRunClass({ text: noteData.topic || "Untitled", size: 24 }),
              ],
              spacing: { after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({ text: "Created: ", bold: true, size: 24 }),
                new TextRunClass({ text: new Date(noteData.created_at).toLocaleDateString(), size: 24 }),
              ],
              spacing: { after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({ text: "Last Updated: ", bold: true, size: 24 }),
                new TextRunClass({
                  text: noteData.updated_at ? new Date(noteData.updated_at).toLocaleDateString() : "Never",
                  size: 24,
                }),
              ],
              spacing: { after: 400 },
            }),
            new ParagraphClass({
              text: "ORIGINAL CONTENT",
              heading: HeadingLevelEnum.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new ParagraphClass({
              children: [new TextRunClass({ text: noteData.content || "No content provided", size: 24 })],
              spacing: { after: 400 },
            }),
            ...(noteData.tags && noteData.tags.length > 0
              ? [
                  new ParagraphClass({
                    text: "TAGS",
                    heading: HeadingLevelEnum.HEADING_1,
                    spacing: { before: 400, after: 200 },
                  }),
                  new ParagraphClass({
                    children: [new TextRunClass({ text: noteData.tags.join(", "), size: 24 })],
                    spacing: { after: 400 },
                  }),
                ]
              : []),
            new ParagraphClass({
              children: [new TextRunClass({ text: "─".repeat(50), size: 20 })],
              spacing: { before: 600, after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({
                  text: "Generated by Stick My Note - AI-Powered Note Export",
                  italics: true,
                  size: 18,
                }),
              ],
            }),
          ],
        },
      ],
    })

    const buffer = await PackerClass.toBuffer(doc)
    const docxBlob = new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    const filename = `note-export-${noteId}-${Date.now()}.docx`
    const blob = await put(filename, Buffer.from(await docxBlob.arrayBuffer()), { folder: "documents" })

    let finalUrl = blob.url
    let message = "Complete note export generated successfully"

    try {
      const cleanupResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/cleanup-docx`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blobUrl: blob.url, filename }),
        },
      )

      if (cleanupResponse.ok) {
        const cleanupResult = await cleanupResponse.json()
        finalUrl = cleanupResult.cleanedUrl
        message = "Complete note export generated and cleaned successfully"
      } else {
        console.warn("DOCX cleanup failed, using original document")
      }
    } catch (cleanupError) {
      console.warn("DOCX cleanup error, using original document:", cleanupError)
    }

    await saveExportLink(db, noteId, user.id, {
      url: finalUrl,
      filename,
      created_at: new Date().toISOString(),
      type: "complete_export",
    })

    return NextResponse.json({
      success: true,
      exportUrl: finalUrl,
      filename,
      message,
    })
  } catch (error) {
    console.error("Export note error:", error)
    return NextResponse.json({ error: `Failed to export note: ${(error as Error).message}` }, { status: 500 })
  }
}

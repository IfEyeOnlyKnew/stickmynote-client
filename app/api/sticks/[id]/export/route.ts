import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

let generateText: any, xai: any, put: any, Document: any, Packer: any, Paragraph: any, TextRun: any, HeadingLevel: any

// Initialize modules with fallbacks
const initializeModules = async () => {
  try {
    const aiModule = await import("ai")
    generateText = aiModule.generateText
  } catch (error) {
    console.warn("ai module not available")
    generateText = async () => ({ text: "AI service unavailable" })
  }

  try {
    const xaiModule = await import("@ai-sdk/xai")
    xai = xaiModule.xai
  } catch (error) {
    console.warn("@ai-sdk/xai not available")
    xai = () => "grok-4"
  }

  try {
    const blobModule = await import("@vercel/blob")
    put = blobModule.put
  } catch (error) {
    console.warn("@vercel/blob not available")
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
    console.warn("docx module not available")
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

interface ExportData {
  exports?: Array<{
    url: string
    filename: string
    created_at: string
    type: string
  }>
  [key: string]: any
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await initializeModules()

  try {
    const { tone = "formal" } = await request.json()
    const stickId = params.id

    if (!stickId) {
      return NextResponse.json({ error: "Stick ID is required" }, { status: 400 })
    }

    // Check if XAI_API_KEY is configured
    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const supabase = await createSupabaseServer()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    // Fetch stick data with pad and multi-pak information
    const { data: stickData, error: stickError } = await supabase
      .from("paks_pad_sticks")
      .select(`
        *,
        pads:paks_pads(
          name, 
          multi_pak_id, 
          owner_id,
          multi_paks(owner_id)
        )
      `)
      .eq("id", stickId)
      .maybeSingle()

    if (stickError || !stickData) {
      return NextResponse.json({ error: "Stick not found or access denied" }, { status: 404 })
    }

    let hasAccess = false

    // Check if user is the pad owner
    if (stickData.pads?.owner_id === user.id) {
      hasAccess = true
    }
    // Check if user is the multi-pak owner (if pad belongs to a multi-pak)
    else if (stickData.pads?.multi_pak_id && stickData.pads?.multi_paks?.owner_id === user.id) {
      hasAccess = true
    }
    // Check direct pad membership
    else {
      const { data: padMember } = await supabase
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", stickData.pad_id)
        .eq("user_id", user.id)
        .eq("accepted", true)
        .maybeSingle()

      if (padMember) {
        hasAccess = true
      }
      // Check multi-pak membership (if pad belongs to a multi-pak)
      else if (stickData.pads?.multi_pak_id) {
        const { data: multiPakMember } = await supabase
          .from("multi_pak_members")
          .select("role")
          .eq("multi_pak_id", stickData.pads.multi_pak_id)
          .eq("user_id", user.id)
          .eq("accepted", true)
          .maybeSingle()

        if (multiPakMember) {
          hasAccess = true
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch stick replies
    const { data: replies } = await supabase
      .from("paks_pad_stick_replies")
      .select(`
        *,
        user:users(username, email)
      `)
      .eq("stick_id", stickId)
      .order("created_at", { ascending: true })

    // Fetch stick tabs
    const { data: stickTabs } = await supabase
      .from("paks_pad_stick_tabs")
      .select("*")
      .eq("stick_id", stickId)
      .order("tab_order", { ascending: true })

    // Process tabs content
    const videoTabs = stickTabs?.filter((tab) => tab.tab_type === "video") || []
    const imageTabs = stickTabs?.filter((tab) => tab.tab_type === "images") || []

    const videoLinks = videoTabs.flatMap((tab) => {
      try {
        let data = tab.tab_data
        if (typeof data === "string") {
          data = JSON.parse(data)
        }
        const videos = data?.videos || []
        return videos.map((video: any) => ({
          ...video,
          embed_url: video.embed_url || video.url,
        }))
      } catch {
        return []
      }
    })

    const imageLinks = imageTabs.flatMap((tab) => {
      try {
        let data = tab.tab_data
        if (typeof data === "string") {
          data = JSON.parse(data)
        }
        return data?.images || []
      } catch {
        return []
      }
    })

    const getTonePrompt = (selectedTone: string) => {
      const toneInstructions = {
        professional:
          "Provide a professional, structured summary suitable for a business report. Use clear, objective language and organize key points logically with distinct paragraphs for different topics.",
        casual:
          "Write this summary in a conversational, friendly tone as if explaining to a friend. Use everyday language and focus on the main takeaways. Break into natural conversation paragraphs.",
        friendly:
          "Write this summary in a warm, approachable tone that's professional yet personable. Focus on collaboration and positive outcomes with clear paragraph breaks.",
        formal:
          "Provide a formal, detailed summary with precise language suitable for official documentation. Structure with clear sections and comprehensive coverage of all topics.",
      }
      return toneInstructions[selectedTone as keyof typeof toneInstructions] || toneInstructions.professional
    }

    // Create comprehensive prompt for AI
    const prompt = `${getTonePrompt(tone)}

Please create a comprehensive summary of this Multi-pak Stick with all its components. Structure your response with clear paragraph breaks using double line breaks (\\n\\n) between different topics:

**Stick Information:**
- Topic: ${stickData.topic || "Untitled"}
- Content: ${stickData.content || "No content"}
- Pad: ${stickData.pads?.name || "Unknown Pad"}
- Created: ${new Date(stickData.created_at).toLocaleDateString()}
- Updated: ${stickData.updated_at ? new Date(stickData.updated_at).toLocaleDateString() : "Never"}

**Media Content:**
${videoLinks.length > 0 ? `- Video Links (${videoLinks.length}): ${videoLinks.map((v) => `${v.title || "Untitled"} (${v.embed_url || v.url})`).join(", ")}` : "- No video content"}
${imageLinks.length > 0 ? `- Image Links (${imageLinks.length}): ${imageLinks.map((i) => `${i.caption || "Untitled"} (${i.url})`).join(", ")}` : "- No image content"}

**Replies and Discussion (${replies?.length || 0} replies):**
${replies && replies.length > 0 ? replies.map((r) => `- ${r.user?.username || r.user?.email || "User"} (${new Date(r.created_at).toLocaleDateString()}): ${r.content}`).join("\\n") : "- No replies yet"}

Please provide a well-structured, comprehensive summary that captures all aspects of this stick. Use clear paragraph breaks (\\n\\n) to separate different topics and themes. Format it as a professional document that could serve as a complete record of this stick's content and discussion.`

    // Generate comprehensive summary using AI
    const { text: comprehensiveSummary } = await generateText({
      model: xai("grok-4"),
      prompt: prompt,
      maxTokens: 2000,
    })

    // Create DOCX document
    const summaryParagraphs = comprehensiveSummary
      .split(/\n\n+/)
      .filter((paragraph: string) => paragraph.trim().length > 0)
      .map((paragraph: string) => paragraph.trim())

    const doc = new Document({
      sections: [
        {
          children: [
            // Title
            new Paragraph({
              text: "MULTI-PAK STICK EXPORT",
              heading: HeadingLevel.TITLE,
              spacing: { after: 400 },
            }),

            // Document metadata
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Tone: ${tone.charAt(0).toUpperCase() + tone.slice(1)}`,
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 600 },
            }),

            // Executive Summary
            new Paragraph({
              text: "EXECUTIVE SUMMARY",
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

            // Stick Information
            new Paragraph({
              text: "STICK INFORMATION",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Topic: ", bold: true, size: 24 }),
                new TextRun({ text: stickData.topic || "Untitled", size: 24 }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Pad: ", bold: true, size: 24 }),
                new TextRun({ text: stickData.pads?.name || "Unknown Pad", size: 24 }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Created: ", bold: true, size: 24 }),
                new TextRun({ text: new Date(stickData.created_at).toLocaleDateString(), size: 24 }),
              ],
              spacing: { after: 200 },
            }),

            // Main Content
            new Paragraph({
              text: "MAIN CONTENT",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: stickData.content || "No content provided.",
                  size: 24,
                }),
              ],
              spacing: { after: 400 },
            }),

            // Media Content
            ...(videoLinks.length > 0 || imageLinks.length > 0
              ? [
                  new Paragraph({
                    text: "MEDIA CONTENT",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                  }),
                  ...(videoLinks.length > 0
                    ? [
                        new Paragraph({
                          children: [new TextRun({ text: "Videos:", bold: true, size: 24 })],
                          spacing: { after: 200 },
                        }),
                        ...videoLinks.map(
                          (video: any) =>
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: `• ${video.title || "Untitled"}: ${video.embed_url || video.url}`,
                                  size: 24,
                                }),
                              ],
                              spacing: { after: 200 },
                            }),
                        ),
                      ]
                    : []),
                  ...(imageLinks.length > 0
                    ? [
                        new Paragraph({
                          children: [new TextRun({ text: "Images:", bold: true, size: 24 })],
                          spacing: { after: 200 },
                        }),
                        ...imageLinks.map(
                          (image: any) =>
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: `• ${image.caption || "Untitled"}: ${image.url}`,
                                  size: 24,
                                }),
                              ],
                              spacing: { after: 200 },
                            }),
                        ),
                      ]
                    : []),
                ]
              : []),

            // Discussion and Replies
            new Paragraph({
              text: `DISCUSSION AND REPLIES (${replies?.length || 0})`,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...(replies && replies.length > 0
              ? replies.flatMap((reply) => [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${reply.user?.username || reply.user?.email || "Anonymous User"}`,
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
                ])
              : [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "No replies or discussion available.",
                        italics: true,
                        size: 24,
                      }),
                    ],
                    spacing: { after: 300 },
                  }),
                ]),

            // Document Footer
            new Paragraph({
              text: "END OF DOCUMENT",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "This document contains a comprehensive export of the Multi-pak Stick including all content, media, and discussion threads. Generated automatically by Stick My Note application.",
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
          ],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const docxBlob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    const sanitizedTopic = (stickData.topic || "Untitled")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .substring(0, 50)

    const filename = `${sanitizedTopic}-export-${Date.now()}.docx`
    const blob = await put(filename, docxBlob, {
      access: "public",
    })

    const exportLink = {
      url: blob.url,
      filename: filename,
      created_at: new Date().toISOString(),
      type: "complete_export",
    }

    const { data: existingDetailsTab } = await supabase
      .from("paks_pad_stick_tabs")
      .select("*")
      .eq("stick_id", stickId)
      .eq("tab_type", "details")
      .maybeSingle()

    if (existingDetailsTab) {
      let currentData = {}
      try {
        if (typeof existingDetailsTab.tab_data === "string") {
          currentData = JSON.parse(existingDetailsTab.tab_data)
        } else if (existingDetailsTab.tab_data && typeof existingDetailsTab.tab_data === "object") {
          currentData = existingDetailsTab.tab_data
        }
      } catch {
        currentData = {}
      }

      const updatedExports = [...((currentData as ExportData).exports || []), exportLink]
      const newTabData = { ...currentData, exports: updatedExports }

      await supabase
        .from("paks_pad_stick_tabs")
        .update({
          tab_data: newTabData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDetailsTab.id)
    } else {
      await supabase.from("paks_pad_stick_tabs").insert({
        stick_id: stickId,
        user_id: user.id,
        tab_type: "details",
        tab_name: "Details",
        tab_content: "Stick details and exports",
        tab_data: { exports: [exportLink] },
        tab_order: 3,
      })
    }

    return NextResponse.json({
      success: true,
      exportUrl: blob.url,
      filename: filename,
      message: "Complete stick export generated successfully",
    })
  } catch (error) {
    console.error("Export stick error:", error)
    return NextResponse.json({ error: `Failed to export stick: ${(error as Error).message}` }, { status: 500 })
  }
}

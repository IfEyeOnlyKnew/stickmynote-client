import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { validateCSRFMiddleware } from "@/lib/csrf"
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

export async function POST(request: NextRequest) {
  // Validate CSRF token for note export
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

    // Check if XAI_API_KEY is configured
    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const supabase = await createSupabaseServer()

    const authResult = await getCachedAuthUser(supabase)

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    let noteData: any = null
    let replies: any[] = []
    let noteTabs: any[] = []

    // Fetch regular note data
    const { data: regularNote, error: noteError } = await supabase
      .from("personal_sticks")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single()

    if (noteError || !regularNote) {
      return NextResponse.json({ error: "Note not found or access denied" }, { status: 404 })
    }

    noteData = regularNote

    // Fetch note replies
    const { data: regularReplies } = await supabase
      .from("personal_sticks_replies")
      .select(`
        *,
        user:users(username, email)
      `)
      .eq("personal_stick_id", noteId)
      .order("created_at", { ascending: true })

    replies = regularReplies || []

    // Fetch note tabs
    const { data: regularTabs } = await supabase
      .from("personal_sticks_tabs")
      .select("*")
      .eq("personal_stick_id", noteId)
      .order("tab_order", { ascending: true })

    noteTabs = regularTabs || []

    // Prepare comprehensive data for AI summary
    const videoTabs = noteTabs.filter((tab) => tab.tab_type === "video")
    const imageTabs = noteTabs.filter((tab) => tab.tab_type === "images")
    const detailsTabs = noteTabs.filter((tab) => tab.tab_type === "details")

    const videoLinks = videoTabs.flatMap((tab) => {
      try {
        let data = tab.tab_data

        // Handle corrupted tab_data that's stored as individual characters
        if (typeof data === "object" && data !== null && !Array.isArray(data)) {
          // Check if it's the corrupted format (object with numeric keys)
          const keys = Object.keys(data)
          if (keys.length > 0 && keys.every((key) => !isNaN(Number(key)))) {
            // Reconstruct the JSON string from individual characters
            const jsonString = keys
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => data[key])
              .join("")
            data = JSON.parse(jsonString)
          }
        } else if (typeof data === "string") {
          data = JSON.parse(data)
        }

        const videos = data.videos || []
        return videos.map((video: any) => ({
          ...video,
          embed_url: video.embed_url || video.url,
        }))
      } catch (error) {
        return []
      }
    })

    const imageLinks = imageTabs.flatMap((tab) => {
      try {
        let data = tab.tab_data

        // Handle corrupted tab_data that's stored as individual characters
        if (typeof data === "object" && data !== null && !Array.isArray(data)) {
          // Check if it's the corrupted format (object with numeric keys)
          const keys = Object.keys(data)
          if (keys.length > 0 && keys.every((key) => !isNaN(Number(key)))) {
            // Reconstruct the JSON string from individual characters
            const jsonString = keys
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => data[key])
              .join("")
            data = JSON.parse(jsonString)
          }
        } else if (typeof data === "string") {
          data = JSON.parse(data)
        }

        const images = data.images || []
        return images
      } catch (error) {
        return []
      }
    })

    // Fetch tags
    const { data: tagsData } = await supabase
      .from("personal_sticks_tags")
      .select("tag_content, tag_title")
      .eq("personal_stick_id", noteId)

    const tags = tagsData || []

    const getTonePrompt = (selectedTone: string) => {
      const toneInstructions = {
        cinematic:
          "Write this summary as if it were a movie script scene description. Use dramatic language, visual imagery, and narrative flow. Focus on the emotional arc and character dynamics. Structure with clear paragraph breaks for different scenes or themes.",
        formal:
          "Provide a professional, structured summary suitable for a business report. Use clear, objective language and organize key points logically with distinct paragraphs for different topics.",
        casual:
          "Write this summary in a conversational, friendly tone as if explaining to a friend. Use everyday language and focus on the main takeaways. Break into natural conversation paragraphs.",
        dramatic:
          "Write this summary as a compelling narrative with rich descriptions and emotional depth, like a chapter from a novel. Emphasize the human elements and story arc with clear paragraph breaks for different narrative elements.",
      }
      return toneInstructions[selectedTone as keyof typeof toneInstructions] || toneInstructions.formal
    }

    // Create comprehensive prompt for AI
    const prompt = `${getTonePrompt(tone)}

Please create a comprehensive summary of this note with all its components. Structure your response with clear paragraph breaks using double line breaks (\\n\\n) between different topics:

**Note Information:**
- Topic: ${noteData.topic || "Untitled"}
- Content: ${noteData.content || "No content"}
- Details: ${noteData.details || "No additional details"}
- Created: ${new Date(noteData.created_at).toLocaleDateString()}
- Updated: ${noteData.updated_at ? new Date(noteData.updated_at).toLocaleDateString() : "Never"}

**Media Content:**
${videoLinks.length > 0 ? `- Video Links (${videoLinks.length}): ${videoLinks.map((v) => `${v.title || "Untitled"} (${v.embed_url || v.url})`).join(", ")}` : "- No video content"}
${imageLinks.length > 0 ? `- Image Links (${imageLinks.length}): ${imageLinks.map((i) => `${i.caption || "Untitled"} (${i.url})`).join(", ")}` : "- No image content"}

**Generated Tags:**
${tags.length > 0 ? tags.map((t) => `- ${t.tag_content}${t.tag_title ? ` (${t.tag_title})` : ""}`).join("\n") : "- No tags generated"}

**Replies and Discussion (${replies.length} replies):**
${replies.length > 0 ? replies.map((r) => `- ${r.user?.username || r.user?.email || "User"} (${new Date(r.created_at).toLocaleDateString()}): ${r.content}`).join("\n") : "- No replies yet"}

Please provide a well-structured, comprehensive summary that captures all aspects of this note. Use clear paragraph breaks (\\n\\n) to separate different topics and themes. Format it as a professional document that could serve as a complete record of this note's content and discussion.`

    // Generate comprehensive summary using AI
    const { text: comprehensiveSummary } = await generateText({
      model: xai("grok-4"),
      prompt: prompt,
      maxTokens: 2000,
    })

    try {
      const summaryParagraphs = comprehensiveSummary
        .split(/\n\n+/)
        .filter((paragraph: string) => paragraph.trim().length > 0)
        .map((paragraph: string) => paragraph.trim())

      const doc = new Document({
        sections: [
          {
            children: [
              // Title with professional formatting
              new Paragraph({
                text: "COMPREHENSIVE NOTE EXPORT",
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

              // Executive Summary Section with proper paragraph formatting
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

              // Note Information Section
              new Paragraph({
                text: "NOTE INFORMATION",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Topic: ", bold: true, size: 24 }),
                  new TextRun({ text: noteData.topic || "Untitled", size: 24 }),
                ],
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Created: ", bold: true, size: 24 }),
                  new TextRun({ text: new Date(noteData.created_at).toLocaleDateString(), size: 24 }),
                ],
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Last Updated: ",
                    bold: true,
                    size: 24,
                  }),
                  new TextRun({
                    text: noteData.updated_at ? new Date(noteData.updated_at).toLocaleDateString() : "Never",
                    size: 24,
                  }),
                ],
                spacing: { after: 400 },
              }),

              // Main Content Section
              new Paragraph({
                text: "MAIN CONTENT",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: noteData.content || "No content provided.",
                    size: 24,
                  }),
                ],
                spacing: { after: 400 },
              }),

              // Additional Details Section (if exists)
              ...(noteData.details
                ? [
                    new Paragraph({
                      text: "ADDITIONAL DETAILS",
                      heading: HeadingLevel.HEADING_1,
                      spacing: { before: 400, after: 200 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: noteData.details,
                          size: 24,
                        }),
                      ],
                      spacing: { after: 400 },
                    }),
                  ]
                : []),

              // Tabs Content Section with proper paragraph structure
              ...(noteTabs.length > 0
                ? [
                    new Paragraph({
                      text: "TAB CONTENT",
                      heading: HeadingLevel.HEADING_1,
                      spacing: { before: 400, after: 200 },
                    }),
                    ...noteTabs.flatMap((tab) => {
                      let tabContent = "No content available."
                      try {
                        let data = tab.tab_data
                        // Handle corrupted tab_data that's stored as individual characters
                        if (typeof data === "object" && data !== null && !Array.isArray(data)) {
                          const keys = Object.keys(data)
                          if (keys.length > 0 && keys.every((key) => !isNaN(Number(key)))) {
                            const jsonString = keys
                              .sort((a, b) => Number(a) - Number(b))
                              .map((key) => data[key])
                              .join("")
                            data = JSON.parse(jsonString)
                          }
                        } else if (typeof data === "string") {
                          data = JSON.parse(data)
                        }

                        if (tab.tab_type === "video" && data.videos?.length > 0) {
                          tabContent = `Video Links (${data.videos.length}):\n${data.videos.map((v: any) => `• ${v.title || "Untitled"}: ${v.embed_url || v.url}`).join("\n")}`
                        } else if (tab.tab_type === "images" && data.images?.length > 0) {
                          tabContent = `Image Links (${data.images.length}):\n${data.images.map((i: any) => `• ${i.caption || "Untitled"}: ${i.url}`).join("\n")}`
                        } else if (tab.tab_content) {
                          tabContent = tab.tab_content
                        }
                      } catch (error) {
                        tabContent = tab.tab_content || "Content unavailable."
                      }

                      // Split tab content into paragraphs if it contains line breaks
                      const tabParagraphs = tabContent.split("\n").filter((line) => line.trim().length > 0)

                      return [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `${tab.tab_name || tab.tab_type.toUpperCase()}`,
                              bold: true,
                              size: 26,
                            }),
                          ],
                          spacing: { after: 200 },
                        }),
                        ...tabParagraphs.map(
                          (paragraphText: string) =>
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: paragraphText,
                                  size: 24,
                                }),
                              ],
                              spacing: { after: 200 },
                            }),
                        ),
                      ]
                    }),
                  ]
                : []),

              // Generated Tags Section
              ...(tags.length > 0
                ? [
                    new Paragraph({
                      text: "GENERATED TAGS",
                      heading: HeadingLevel.HEADING_1,
                      spacing: { before: 400, after: 200 },
                    }),
                    ...tags.map(
                      (tag) =>
                        new Paragraph({
                          children: [
                            new TextRun({ text: "• ", bold: true, size: 24 }),
                            new TextRun({ text: tag.tag_content, bold: true, size: 24 }),
                            ...(tag.tag_title
                              ? [new TextRun({ text: " - ", size: 24 }), new TextRun({ text: tag.tag_title, size: 24 })]
                              : []),
                          ],
                          spacing: { after: 200 },
                        }),
                    ),
                  ]
                : []),

              // Discussion and Replies Section with proper paragraph structure for each reply
              new Paragraph({
                text: `DISCUSSION AND REPLIES (${replies.length})`,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              ...(replies.length > 0
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
                    text: "This document contains a comprehensive export of the note including all content, tabs, tags, and discussion threads. Generated automatically by Stick My Note application.",
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

      const filename = `note-export-${noteId}-${Date.now()}.docx`
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

          const exportLink = {
            url: cleanupResult.cleanedUrl,
            filename: filename,
            created_at: new Date().toISOString(),
            type: "complete_export",
          }

          // Store the cleaned export link in Details tab
          const { data: existingDetailsTab } = await supabase
            .from("personal_sticks_tabs")
            .select("*")
            .eq("personal_stick_id", noteId)
            .eq("tab_type", "details")
            .single()

          if (existingDetailsTab) {
            let currentData = {}
            try {
              if (typeof existingDetailsTab.tab_data === "string") {
                currentData = JSON.parse(existingDetailsTab.tab_data)
              } else if (existingDetailsTab.tab_data && typeof existingDetailsTab.tab_data === "object") {
                currentData = existingDetailsTab.tab_data
              }
            } catch (error) {
              currentData = {}
            }

            const updatedExports = [...((currentData as ExportData).exports || []), exportLink]
            const newTabData = { ...currentData, exports: updatedExports }

            await supabase
              .from("personal_sticks_tabs")
              .update({
                tab_data: newTabData,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingDetailsTab.id)
          } else {
            await supabase.from("personal_sticks_tabs").insert({
              personal_stick_id: noteId,
              user_id: user.id,
              tab_type: "details",
              tab_name: "Details",
              tab_content: "Note details and exports",
              tab_data: { exports: [exportLink] },
              tab_order: 3,
            })
          }

          return NextResponse.json({
            success: true,
            exportUrl: cleanupResult.cleanedUrl,
            filename: filename,
            message: "Complete note export generated and cleaned successfully",
          })
        } else {
          console.warn("DOCX cleanup failed, using original document")
          // Fall back to original document if cleanup fails
          const exportLink = {
            url: blob.url,
            filename: filename,
            created_at: new Date().toISOString(),
            type: "complete_export",
          }

          // Store the original export link in Details tab
          const { data: existingDetailsTab } = await supabase
            .from("personal_sticks_tabs")
            .select("*")
            .eq("personal_stick_id", noteId)
            .eq("tab_type", "details")
            .single()

          if (existingDetailsTab) {
            let currentData = {}
            try {
              if (typeof existingDetailsTab.tab_data === "string") {
                currentData = JSON.parse(existingDetailsTab.tab_data)
              } else if (existingDetailsTab.tab_data && typeof existingDetailsTab.tab_data === "object") {
                currentData = existingDetailsTab.tab_data
              }
            } catch (error) {
              currentData = {}
            }

            const updatedExports = [...((currentData as ExportData).exports || []), exportLink]
            const newTabData = { ...currentData, exports: updatedExports }

            await supabase
              .from("personal_sticks_tabs")
              .update({
                tab_data: newTabData,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingDetailsTab.id)
          } else {
            await supabase.from("personal_sticks_tabs").insert({
              personal_stick_id: noteId,
              user_id: user.id,
              tab_type: "details",
              tab_name: "Details",
              tab_content: "Note details and exports",
              tab_data: { exports: [exportLink] },
              tab_order: 3,
            })
          }

          return NextResponse.json({
            success: true,
            exportUrl: blob.url,
            filename: filename,
            message: "Complete note export generated successfully",
          })
        }
      } catch (cleanupError) {
        console.warn("DOCX cleanup error, using original document:", cleanupError)
        // Fall back to original document if cleanup fails
        const exportLink = {
          url: blob.url,
          filename: filename,
          created_at: new Date().toISOString(),
          type: "complete_export",
        }

        // Store the original export link in Details tab
        const { data: existingDetailsTab } = await supabase
          .from("personal_sticks_tabs")
          .select("*")
          .eq("personal_stick_id", noteId)
          .eq("tab_type", "details")
          .single()

        if (existingDetailsTab) {
          let currentData = {}
          try {
            if (typeof existingDetailsTab.tab_data === "string") {
              currentData = JSON.parse(existingDetailsTab.tab_data)
            } else if (existingDetailsTab.tab_data && typeof existingDetailsTab.tab_data === "object") {
              currentData = existingDetailsTab.tab_data
            }
          } catch (error) {
            currentData = {}
          }

          const updatedExports = [...((currentData as ExportData).exports || []), exportLink]
          const newTabData = { ...currentData, exports: updatedExports }

          await supabase
            .from("personal_sticks_tabs")
            .update({
              tab_data: newTabData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingDetailsTab.id)
        } else {
          await supabase.from("personal_sticks_tabs").insert({
            personal_stick_id: noteId,
            user_id: user.id,
            tab_type: "details",
            tab_name: "Details",
            tab_content: "Note details and exports",
            tab_data: { exports: [exportLink] },
            tab_order: 3,
          })
        }

        return NextResponse.json({
          success: true,
          exportUrl: blob.url,
          filename: filename,
          message: "Complete note export generated successfully",
        })
      }
    } catch (docxError) {
      console.error("DOCX generation error:", docxError)
      throw new Error(`DOCX generation failed: ${docxError instanceof Error ? docxError.message : String(docxError)}`)
    }
  } catch (error) {
    console.error("Export note error:", error)
    return NextResponse.json({ error: `Failed to export note: ${(error as Error).message}` }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { summarizeLinks } from "@/lib/ai/url-summarizer"
import { isAIAvailable, checkOllamaHealth, getActiveProvider } from "@/lib/ai/ai-provider"
import { writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

// Dynamic imports for docx
let Document: typeof import("docx").Document | undefined
let Packer: typeof import("docx").Packer | undefined
let Paragraph: typeof import("docx").Paragraph | undefined
let TextRun: typeof import("docx").TextRun | undefined
let HeadingLevel: typeof import("docx").HeadingLevel | undefined
let ExternalHyperlink: typeof import("docx").ExternalHyperlink | undefined

async function upsertNoteExportLink(noteId: string, userId: string, exportLink: any): Promise<void> {
  const detailsTabResult = await db.query(
    `SELECT id, tab_data FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND tab_type = 'details' ORDER BY created_at DESC LIMIT 1`,
    [noteId],
  )

  if (detailsTabResult.rows.length > 0) {
    const currentData = (typeof detailsTabResult.rows[0].tab_data === "object" && detailsTabResult.rows[0].tab_data) || {}
    const newTabData = { ...currentData, exports: [...(currentData.exports || []), exportLink] }
    await db.query(`UPDATE personal_sticks_tabs SET tab_data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newTabData), detailsTabResult.rows[0].id])
  } else {
    await db.query(
      `INSERT INTO personal_sticks_tabs (personal_stick_id, user_id, tab_type, tab_name, tab_data, tab_order) VALUES ($1, $2, 'details', 'Details', $3, 3)`,
      [noteId, userId, JSON.stringify({ exports: [exportLink] })],
    )
  }

  await db.query(`UPDATE personal_sticks SET updated_at = NOW() WHERE id = $1`, [noteId])
}

function extractLinksFromTab(row: any): Array<{ url: string; title: string }> {
  if (!row) return []
  if (row.tab_data?.hyperlinks) return row.tab_data.hyperlinks

  const tags = row.tags
  if (!tags) return []

  let parsed = tags
  if (typeof tags === "string") {
    try { parsed = JSON.parse(tags) } catch { return [] }
  }

  if (Array.isArray(parsed)) return parsed.filter((item: any) => item && (item.url || item.title))
  if (Array.isArray(parsed?.hyperlinks)) return parsed.hyperlinks
  return []
}

const initializeDocx = async () => {
  try {
    const docxModule = await import("docx")
    Document = docxModule.Document
    Packer = docxModule.Packer
    Paragraph = docxModule.Paragraph
    TextRun = docxModule.TextRun
    HeadingLevel = docxModule.HeadingLevel
    ExternalHyperlink = docxModule.ExternalHyperlink
    return true
  } catch (error) {
    console.error("docx module not available:", error)
    return false
  }
}

interface LinkSummary {
  url: string
  title: string
  summary: string | null
  error?: string
}

function createDocxDocument(
  noteTitle: string,
  summaries: LinkSummary[],
  provider: string
): any {
  if (!Document || !Paragraph || !TextRun || !HeadingLevel || !ExternalHyperlink) {
    throw new Error("docx module not initialized")
  }

  // Assign to local const to satisfy TypeScript after the null check
  const DocxParagraph = Paragraph
  const DocxTextRun = TextRun
  const DocxHeadingLevel = HeadingLevel
  const DocxExternalHyperlink = ExternalHyperlink

  const children: any[] = [
    // Title
    new DocxParagraph({
      text: "LINK SUMMARY REPORT",
      heading: DocxHeadingLevel.TITLE,
      spacing: { after: 400 },
    }),
    // Subtitle with note info
    new DocxParagraph({
      children: [
        new DocxTextRun({
          text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
    new DocxParagraph({
      children: [
        new DocxTextRun({
          text: `AI Provider: ${provider} | Links Summarized: ${summaries.filter(s => s.summary).length}/${summaries.length}`,
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 600 },
    }),
  ]

  // Add each link summary
  summaries.forEach((item, index) => {
    // Link title as heading + URL
    children.push(
      new DocxParagraph({
        text: `${index + 1}. ${item.title || "Untitled Link"}`,
        heading: DocxHeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      new DocxParagraph({
        children: [
          new DocxTextRun({ text: "URL: ", bold: true, size: 22 }),
          new DocxExternalHyperlink({
            children: [
              new DocxTextRun({
                text: item.url,
                style: "Hyperlink",
                size: 22,
              }),
            ],
            link: item.url,
          }),
        ],
        spacing: { after: 200 },
      })
    )

    // Summary or error
    if (item.summary) {
      children.push(
        new DocxParagraph({
          children: [
            new DocxTextRun({ text: "Summary:", bold: true, size: 22 }),
          ],
          spacing: { after: 100 },
        }),
        new DocxParagraph({
          children: [
            new DocxTextRun({ text: item.summary, size: 22 }),
          ],
          spacing: { after: 300 },
        })
      )
    } else if (item.error) {
      children.push(
        new DocxParagraph({
          children: [
            new DocxTextRun({
              text: `Error: ${item.error}`,
              italics: true,
              color: "FF0000",
              size: 22,
            }),
          ],
          spacing: { after: 300 },
        })
      )
    }

    // Separator line
    children.push(
      new DocxParagraph({
        children: [new DocxTextRun({ text: "─".repeat(50), size: 18, color: "CCCCCC" })],
        spacing: { after: 200 },
      })
    )
  })

  // Footer
  children.push(
    new DocxParagraph({
      children: [
        new DocxTextRun({
          text: "Generated by Stick My Note - AI-Powered Link Summarization",
          italics: true,
          size: 18,
        }),
      ],
      spacing: { before: 400 },
    })
  )

  return new Document({
    sections: [{ children }],
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: noteId } = await params
    const userId = session.user.id

    // Check if AI is available
    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "No AI provider configured. Please configure Ollama, Azure OpenAI, or another AI provider." },
        { status: 503 }
      )
    }

    // If using Ollama, check if it's reachable first
    const activeProvider = getActiveProvider()
    if (activeProvider === "ollama") {
      const healthCheck = await checkOllamaHealth()
      if (!healthCheck.available) {
        console.error(`[Summarize Links] Ollama health check failed: ${healthCheck.error}`)
        return NextResponse.json(
          { error: `AI server unavailable: ${healthCheck.error}. Please check that the Ollama server is running.` },
          { status: 503 }
        )
      }
      console.log("[Summarize Links] Ollama health check passed")
    }

    // Initialize docx module
    const docxAvailable = await initializeDocx()
    if (!docxAvailable || !Packer) {
      return NextResponse.json(
        { error: "Document export module not available. Please install the docx package." },
        { status: 500 }
      )
    }

    // Get the note and verify ownership
    const noteResult = await db.query(
      `SELECT id, user_id, topic, title FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const note = noteResult.rows[0]

    // Verify user is the owner
    if (note.user_id !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get the links from the note's tabs (Tags tab stores hyperlinks)
    const linksTabResult = await db.query(
      `SELECT tab_data, tags FROM personal_sticks_tabs
       WHERE personal_stick_id = $1 AND (tab_type = 'links' OR tab_name = 'Tags')
       ORDER BY created_at DESC
       LIMIT 1`,
      [noteId]
    )

    const links = extractLinksFromTab(linksTabResult.rows[0])

    if (links.length === 0) {
      return NextResponse.json(
        { error: "No links found. Please generate links first using the Generate Links button." },
        { status: 400 }
      )
    }

    // Summarize the links
    console.log(`[Summarize Links] Starting summarization of ${links.length} links...`)
    const result = await summarizeLinks(links)

    if (result.errors.length > 0 && result.summaries.length === 0) {
      return NextResponse.json(
        { error: "Failed to summarize any links: " + result.errors.join(", ") },
        { status: 500 }
      )
    }

    // Create the docx document
    const noteTitle = note.topic || note.title || "Untitled Note"
    const doc = createDocxDocument(noteTitle, result.summaries, result.provider)

    // Generate the docx buffer
    const buffer = await Packer.toBuffer(doc)

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(process.cwd(), "public", "exports")
    if (!existsSync(exportsDir)) {
      await mkdir(exportsDir, { recursive: true })
    }

    // Generate filename
    const timestamp = Date.now()
    const safeTitle = noteTitle.replaceAll(/[^a-zA-Z0-9]/g, "-").substring(0, 30)
    const filename = `link-summary-${safeTitle}-${timestamp}.docx`
    const filePath = path.join(exportsDir, filename)

    // Write the file
    await writeFile(filePath, buffer)

    // Create the public URL
    const exportUrl = `/exports/${filename}`

    // Create export link record
    const exportLink = {
      url: exportUrl,
      filename,
      created_at: new Date().toISOString(),
      type: "link_summary",
    }

    await upsertNoteExportLink(noteId, userId, exportLink)

    console.log(`[Summarize Links] Export saved to ${filePath}`)

    return NextResponse.json({
      success: true,
      exportUrl,
      filename,
      summaryCount: result.summaries.filter((s) => s.summary).length,
      totalLinks: links.length,
      provider: result.provider,
      errors: result.errors,
      message: `Summarized ${result.summaries.filter((s) => s.summary).length} of ${links.length} links. Download available in the Details tab.`,
    })
  } catch (error) {
    console.error("Error summarizing links:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to summarize links" },
      { status: 500 }
    )
  }
}

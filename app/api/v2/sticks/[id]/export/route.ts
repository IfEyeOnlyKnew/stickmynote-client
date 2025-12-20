// v2 Sticks Export API: production-quality, export stick to DOCX
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

let generateText: typeof import('ai').generateText | undefined
let put: typeof import('@vercel/blob').put | undefined
let Document: typeof import('docx').Document | undefined
let Packer: typeof import('docx').Packer | undefined
let Paragraph: typeof import('docx').Paragraph | undefined
let TextRun: typeof import('docx').TextRun | undefined
let HeadingLevel: typeof import('docx').HeadingLevel | undefined

const initializeModules = async () => {
  try {
    const aiModule = await import('ai')
    generateText = aiModule.generateText
  } catch {}

  try {
    const blobModule = await import('@vercel/blob')
    put = blobModule.put
  } catch {}

  try {
    const docxModule = await import('docx')
    Document = docxModule.Document
    Packer = docxModule.Packer
    Paragraph = docxModule.Paragraph
    TextRun = docxModule.TextRun
    HeadingLevel = docxModule.HeadingLevel
  } catch {}
}

const toneInstructions: Record<string, string> = {
  professional: 'Provide a professional, structured summary suitable for a business report.',
  casual: 'Write this summary in a conversational, friendly tone.',
  friendly: 'Write this summary in a warm, approachable tone.',
  formal: 'Provide a formal, detailed summary with precise language.',
}

function getTonePrompt(tone: string): string {
  return toneInstructions[tone] || toneInstructions.professional
}

// POST /api/v2/sticks/[id]/export - Export stick to DOCX
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initializeModules()

  try {
    const { id: stickId } = await params
    const { tone = 'formal' } = await request.json()

    if (!process.env.XAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    // Get stick with pad info
    const stickResult = await db.query(
      `SELECT s.*, p.name as pad_name, p.owner_id as pad_owner_id
       FROM paks_pad_sticks s
       LEFT JOIN paks_pads p ON s.pad_id = p.id
       WHERE s.id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stickData = stickResult.rows[0]

    // Check access
    if (stickData.pad_owner_id !== user.id) {
      const memberResult = await db.query(
        `SELECT role FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2 AND accepted = true`,
        [stickData.pad_id, user.id]
      )
      if (memberResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
      }
    }

    // Get replies
    const repliesResult = await db.query(
      `SELECT r.*, u.username, u.email
       FROM paks_pad_stick_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.stick_id = $1
       ORDER BY r.created_at ASC`,
      [stickId]
    )

    // Get tabs for media content
    const tabsResult = await db.query(
      `SELECT * FROM paks_pad_stick_tabs WHERE stick_id = $1 ORDER BY tab_order ASC`,
      [stickId]
    )

    const videoTabs = tabsResult.rows.filter((t: any) => t.tab_type === 'video')
    const imageTabs = tabsResult.rows.filter((t: any) => t.tab_type === 'images')

    const videoLinks = videoTabs.flatMap((tab: any) => {
      try {
        const data = typeof tab.tab_data === 'string' ? JSON.parse(tab.tab_data) : tab.tab_data
        return data?.videos || []
      } catch {
        return []
      }
    })

    const imageLinks = imageTabs.flatMap((tab: any) => {
      try {
        const data = typeof tab.tab_data === 'string' ? JSON.parse(tab.tab_data) : tab.tab_data
        return data?.images || []
      } catch {
        return []
      }
    })

    // Build AI prompt
    const repliesFormatted = repliesResult.rows.length > 0
      ? repliesResult.rows.map((r: any) => `- ${r.username || r.email || 'User'}: ${r.content}`).join('\n')
      : '- No replies yet'

    const prompt = `${getTonePrompt(tone)}

Please create a comprehensive summary of this Stick:

**Stick Information:**
- Topic: ${stickData.topic || 'Untitled'}
- Content: ${stickData.content || 'No content'}
- Pad: ${stickData.pad_name || 'Unknown Pad'}
- Created: ${new Date(stickData.created_at).toLocaleDateString()}

**Media Content:**
- Videos: ${videoLinks.length > 0 ? videoLinks.map((v: any) => v.title || v.url).join(', ') : 'None'}
- Images: ${imageLinks.length > 0 ? imageLinks.map((i: any) => i.caption || i.url).join(', ') : 'None'}

**Replies (${repliesResult.rows.length}):**
${repliesFormatted}

Provide a well-structured summary.`

    // Generate AI summary
    const { text: summary } = await generateText?.({
      model: 'xai/grok-3' as any,
      prompt,
      maxOutputTokens: 2000,
    }) || { text: 'AI service unavailable' }

    if (!Document || !Paragraph || !TextRun || !Packer) {
      return new Response(JSON.stringify({ error: 'DOCX generation not available' }), { status: 500 })
    }

    const DocxDocument = Document
    const DocxParagraph = Paragraph
    const DocxTextRun = TextRun
    const DocxPacker = Packer

    // Create DOCX
    const summaryParagraphs = summary.split(/\n\n+/).filter((p: string) => p.trim()).map((p: string) => p.trim())

    const doc = new DocxDocument({
      sections: [{
        children: [
          new DocxParagraph({ text: 'STICK EXPORT', heading: HeadingLevel?.TITLE, spacing: { after: 400 } }),
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: `Generated on ${new Date().toLocaleDateString()}`, italics: true, size: 20 }),
            ],
            spacing: { after: 600 },
          }),
          new DocxParagraph({ text: 'SUMMARY', heading: HeadingLevel?.HEADING_1, spacing: { before: 400, after: 200 } }),
          ...summaryParagraphs.map((p: string) =>
            new DocxParagraph({ children: [new DocxTextRun({ text: p, size: 24 })], spacing: { after: 300 } })
          ),
          new DocxParagraph({ text: 'STICK INFORMATION', heading: HeadingLevel?.HEADING_1, spacing: { before: 400, after: 200 } }),
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: 'Topic: ', bold: true, size: 24 }),
              new DocxTextRun({ text: stickData.topic || 'Untitled', size: 24 }),
            ],
            spacing: { after: 200 },
          }),
          new DocxParagraph({
            children: [
              new DocxTextRun({ text: 'Pad: ', bold: true, size: 24 }),
              new DocxTextRun({ text: stickData.pad_name || 'Unknown', size: 24 }),
            ],
            spacing: { after: 200 },
          }),
          new DocxParagraph({ text: 'MAIN CONTENT', heading: HeadingLevel?.HEADING_1, spacing: { before: 400, after: 200 } }),
          new DocxParagraph({
            children: [new DocxTextRun({ text: stickData.content || 'No content', size: 24 })],
            spacing: { after: 400 },
          }),
          new DocxParagraph({
            text: `REPLIES (${repliesResult.rows.length})`,
            heading: HeadingLevel?.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          ...(repliesResult.rows.length > 0
            ? repliesResult.rows.flatMap((r: any) => [
                new DocxParagraph({
                  children: [
                    new DocxTextRun({ text: r.username || r.email || 'User', bold: true, size: 26 }),
                    new DocxTextRun({ text: ` (${new Date(r.created_at).toLocaleDateString()})`, italics: true, size: 22 }),
                  ],
                  spacing: { after: 100 },
                }),
                new DocxParagraph({
                  children: [new DocxTextRun({ text: r.content, size: 24 })],
                  spacing: { after: 400 },
                }),
              ])
            : [new DocxParagraph({
                children: [new DocxTextRun({ text: 'No replies.', italics: true, size: 24 })],
                spacing: { after: 300 },
              })]),
        ],
      }],
    })

    const buffer = await DocxPacker.toBuffer(doc)
    const docxBlob = new Blob([new Uint8Array(buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const sanitizedTopic = (stickData.topic || 'Untitled')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50)

    const filename = `${sanitizedTopic}-export-${Date.now()}.docx`
    const blob = await put?.(filename, docxBlob, { access: 'public' }) || { url: '' }

    // Save export link to details tab
    const exportLink = {
      url: blob.url,
      filename,
      created_at: new Date().toISOString(),
      type: 'complete_export',
    }

    const existingTab = await db.query(
      `SELECT id, tab_data FROM paks_pad_stick_tabs WHERE stick_id = $1 AND tab_type = 'details'`,
      [stickId]
    )

    if (existingTab.rows.length > 0) {
      let currentData: any = {}
      try {
        currentData = typeof existingTab.rows[0].tab_data === 'string'
          ? JSON.parse(existingTab.rows[0].tab_data)
          : existingTab.rows[0].tab_data || {}
      } catch {}

      const updatedExports = [...(currentData.exports || []), exportLink]
      await db.query(
        `UPDATE paks_pad_stick_tabs SET tab_data = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ ...currentData, exports: updatedExports }), existingTab.rows[0].id]
      )
    } else {
      await db.query(
        `INSERT INTO paks_pad_stick_tabs (stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order)
         VALUES ($1, $2, 'details', 'Details', 'Stick details and exports', $3, 3)`,
        [stickId, user.id, JSON.stringify({ exports: [exportLink] })]
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        exportUrl: blob.url,
        filename,
        message: 'Stick export generated successfully',
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

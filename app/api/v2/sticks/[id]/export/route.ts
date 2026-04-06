// v2 Sticks Export API: production-quality, export stick to DOCX
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isAIAvailable, generateText as aiGenerateText } from '@/lib/ai/ai-provider'
import { put } from '@/lib/storage/local-storage'
import {
  type ExportLink,
  getTonePrompt,
  generateExportFilename,
  buildExportLink,
  initializeDocxModules,
  splitSummaryIntoParagraphs,
} from '@/lib/handlers/stick-export-handler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Auth guard: returns user or an error Response
async function authenticateUser(): Promise<{ user: any } | { error: Response }> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      ),
    }
  }
  if (!authResult.user) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }
  }
  return { user: authResult.user }
}

// Verify user can access the stick (pad owner or member)
async function checkExportAccess(stickData: any, userId: string): Promise<Response | null> {
  if (stickData.pad_owner_id === userId) return null

  const memberResult = await db.query(
    `SELECT role FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2 AND accepted = true`,
    [stickData.pad_id, userId]
  )
  if (memberResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
  }
  return null
}

// Extract media links from tabs
function extractMediaFromTabs(tabs: any[]): { videoLinks: any[]; imageLinks: any[] } {
  const videoTabs = tabs.filter((t: any) => t.tab_type === 'video')
  const imageTabs = tabs.filter((t: any) => t.tab_type === 'images')

  const parseTabMedia = (tab: any, key: string) => {
    try {
      const data = typeof tab.tab_data === 'string' ? JSON.parse(tab.tab_data) : tab.tab_data
      return data?.[key] || []
    } catch {
      return []
    }
  }

  return {
    videoLinks: videoTabs.flatMap((tab: any) => parseTabMedia(tab, 'videos')),
    imageLinks: imageTabs.flatMap((tab: any) => parseTabMedia(tab, 'images')),
  }
}

// Generate AI summary, falling back gracefully
async function generateSummary(prompt: string): Promise<string> {
  try {
    const result = await aiGenerateText({ prompt, maxTokens: 2000 })
    return result.text
  } catch (e) {
    console.error('AI generation failed:', e)
    return 'AI service unavailable'
  }
}

// Save export link into the stick's details tab
async function saveExportLinkToDetailsTab(
  stickId: string,
  userId: string,
  orgId: string,
  exportLink: ExportLink
): Promise<void> {
  const existingTab = await db.query(
    `SELECT id, tab_data FROM paks_pad_stick_tabs WHERE stick_id = $1 AND tab_type = 'details' AND org_id = $2`,
    [stickId, orgId]
  )

  if (existingTab.rows.length > 0) {
    let currentData: any = {}
    try {
      currentData = typeof existingTab.rows[0].tab_data === 'string'
        ? JSON.parse(existingTab.rows[0].tab_data)
        : existingTab.rows[0].tab_data || {}
    } catch {
      // Parse error ignored — using empty default for tab_data
    }

    const updatedExports = [...(currentData.exports || []), exportLink]
    await db.query(
      `UPDATE paks_pad_stick_tabs SET tab_data = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`,
      [JSON.stringify({ ...currentData, exports: updatedExports }), existingTab.rows[0].id, orgId]
    )
  } else {
    await db.query(
      `INSERT INTO paks_pad_stick_tabs (stick_id, user_id, org_id, tab_type, tab_name, tab_content, tab_data, tab_order)
       VALUES ($1, $2, $3, 'details', 'Details', 'Stick details and exports', $4, 3)`,
      [stickId, userId, orgId, JSON.stringify({ exports: [exportLink] })]
    )
  }
}

// POST /api/v2/sticks/[id]/export - Export stick to DOCX
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const docx = await initializeDocxModules()

  try {
    const { id: stickId } = await params
    const { tone = 'formal' } = await request.json()

    if (!isAIAvailable()) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

    const authGuard = await authenticateUser()
    if ('error' in authGuard) return authGuard.error
    const user = authGuard.user

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

    const accessDenied = await checkExportAccess(stickData, user.id)
    if (accessDenied) return accessDenied

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

    const { videoLinks, imageLinks } = extractMediaFromTabs(tabsResult.rows)

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

    const summary = await generateSummary(prompt)

    if (!docx) {
      return new Response(JSON.stringify({ error: 'DOCX generation not available' }), { status: 500 })
    }

    const { Document: DocxDocument, Paragraph: DocxParagraph, TextRun: DocxTextRun, Packer: DocxPacker, HeadingLevel } = docx

    // Create DOCX
    const summaryParagraphs = splitSummaryIntoParagraphs(summary)

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

    const filename = generateExportFilename(stickData.topic)
    const blob = await put(filename, Buffer.from(await docxBlob.arrayBuffer()), { folder: 'documents' })

    // Save export link to details tab using stick's org_id
    const exportLink = buildExportLink(blob.url, filename)
    await saveExportLinkToDetailsTab(stickId, user.id, stickData.org_id, exportLink)

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

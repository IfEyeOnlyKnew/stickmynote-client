import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { summarizeLinks, formatSummariesAsHtml } from "@/lib/ai/url-summarizer"
import { isAIAvailable } from "@/lib/ai/ai-provider"

async function verifyStickAccess(stick: any, userId: string): Promise<boolean> {
  if (stick.user_id === userId || stick.pad_owner_id === userId) return true
  const memberResult = await db.query(
    `SELECT 1 FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2`,
    [stick.pad_id, userId],
  )
  return memberResult.rows.length > 0
}

async function upsertDetailsTab(stickId: string, userId: string, orgId: string, htmlSummary: string): Promise<void> {
  const detailsTabResult = await db.query(
    `SELECT id, tab_data FROM paks_pad_stick_tabs
     WHERE stick_id = $1 AND tab_type = 'details'
     ORDER BY created_at DESC LIMIT 1`,
    [stickId],
  )

  const existingContent = detailsTabResult.rows[0]?.tab_data?.content || ""
  const newContent = existingContent ? `${existingContent}\n\n<hr>\n\n${htmlSummary}` : htmlSummary

  if (detailsTabResult.rows.length > 0) {
    await db.query(
      `UPDATE paks_pad_stick_tabs SET tab_data = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ content: newContent }), detailsTabResult.rows[0].id],
    )
  } else {
    await db.query(
      `INSERT INTO paks_pad_stick_tabs (stick_id, user_id, org_id, tab_type, tab_name, tab_data, tab_order)
       VALUES ($1, $2, $3, 'details', 'Details', $4, 3)`,
      [stickId, userId, orgId, JSON.stringify({ content: newContent })],
    )
  }

  await db.query(`UPDATE paks_pad_sticks SET details = $1, updated_at = NOW() WHERE id = $2`, [newContent, stickId])
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: stickId } = await params

    // Check if AI is available
    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "No AI provider configured. Please configure Ollama, Azure OpenAI, or another AI provider." },
        { status: 503 }
      )
    }

    // Get the stick and verify ownership/access
    const stickResult = await db.query(
      `SELECT ps.*, p.owner_id as pad_owner_id
       FROM paks_pad_sticks ps
       JOIN paks_pads p ON ps.pad_id = p.id
       WHERE ps.id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Verify user has access (owner of stick or pad)
    const userId = session.user.id
    const hasAccess = await verifyStickAccess(stick, userId)
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get the links from the stick's tabs
    const linksTabResult = await db.query(
      `SELECT tab_data FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND tab_type = 'links'
       ORDER BY created_at DESC
       LIMIT 1`,
      [stickId]
    )

    let links: Array<{ url: string; title: string }> = []

    if (linksTabResult.rows.length > 0) {
      const tabData = linksTabResult.rows[0].tab_data
      if (tabData?.hyperlinks) {
        links = tabData.hyperlinks
      }
    }

    if (links.length === 0) {
      return NextResponse.json(
        { error: "No links found. Please generate links first using the Generate Links button." },
        { status: 400 }
      )
    }

    // Summarize the links
    const result = await summarizeLinks(links)

    if (result.errors.length > 0 && result.summaries.length === 0) {
      return NextResponse.json(
        { error: "Failed to summarize any links: " + result.errors.join(", ") },
        { status: 500 }
      )
    }

    // Format as HTML for the Details tab
    const htmlSummary = formatSummariesAsHtml(result)

    // Upsert details tab content with the summary
    await upsertDetailsTab(stickId, userId, stick.org_id, htmlSummary)

    return NextResponse.json({
      success: true,
      summaryCount: result.summaries.filter((s) => s.summary).length,
      totalLinks: links.length,
      provider: result.provider,
      errors: result.errors,
      message: `Summarized ${result.summaries.filter((s) => s.summary).length} of ${links.length} links. Check the Details tab.`,
    })
  } catch (error) {
    console.error("Error summarizing links:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to summarize links" },
      { status: 500 }
    )
  }
}

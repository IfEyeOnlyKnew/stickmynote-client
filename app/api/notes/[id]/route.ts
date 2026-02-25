import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { sanitizeRequestBody } from "@/lib/html-sanitizer"
import { checkDLPPolicy } from "@/lib/dlp/policy-checker"
import { isUnderLegalHold } from "@/lib/legal-hold/check-hold"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================================
// GET - Fetch single note
// ============================================================================

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params
    const noteId = params.id
    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    // Fetch the main note
    const noteResult = await db.query(
      `SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, session.user.id]
    )

    if (noteResult.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const note = noteResult.rows[0]

    // Fetch tabs data
    const tabsResult = await db.query(
      `SELECT tab_type, tab_data, tab_name, tags FROM personal_sticks_tabs WHERE personal_stick_id = $1`,
      [noteId]
    )
    const noteTabs = tabsResult.rows

    // Parse tabs for details, videos, images, hyperlinks
    let details = ""
    let videos: any[] = []
    let images: any[] = []
    let hyperlinks: { url: string; title?: string }[] = []

    if (noteTabs && Array.isArray(noteTabs)) {
      const detailsTab = noteTabs.find((tab: any) => tab.tab_type === "details")
      if (detailsTab && detailsTab.tab_data?.content) {
        details = detailsTab.tab_data.content
      }

      const videosTab = noteTabs.find((tab: any) => tab.tab_type === "videos" || tab.tab_type === "video")
      if (videosTab && videosTab.tab_data) {
        videos = Array.isArray(videosTab.tab_data) ? videosTab.tab_data : []
      }

      const imagesTab = noteTabs.find((tab: any) => tab.tab_type === "images")
      if (imagesTab && imagesTab.tab_data) {
        images = Array.isArray(imagesTab.tab_data) ? imagesTab.tab_data : []
      }

      const tagsTab = noteTabs.find((tab: any) => tab.tab_name === "Tags")
      if (tagsTab && tagsTab.tags) {
        try {
          hyperlinks = Array.isArray(tagsTab.tags)
            ? tagsTab.tags
            : typeof tagsTab.tags === "string"
              ? JSON.parse(tagsTab.tags || "[]")
              : []
        } catch (err) {
          console.warn(`Failed to parse hyperlinks for note ${noteId}:`, err)
          hyperlinks = []
        }
      }
    }

    // Fetch tags data
    const tagsResult = await db.query(
      `SELECT tag_title, tag_content, tag_order FROM personal_sticks_tags WHERE personal_stick_id = $1 ORDER BY tag_order ASC`,
      [noteId]
    )
    const tags = (tagsResult.rows || []).map((t: { tag_title: string }) => t.tag_title)

    // Return note with all related data
    return NextResponse.json({
      ...note,
      details,
      tags,
      images,
      videos,
      hyperlinks,
    })
  } catch (err) {
    console.error("GET /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PUT - Full update of note
// ============================================================================

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params
    const noteId = params.id
    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body, ["topic", "content"])

    // DLP check when sharing a note
    if (sanitizedBody.is_shared === true) {
      const noteForDLP = await db.query(
        `SELECT org_id, topic, content, sensitivity_level FROM personal_sticks WHERE id = $1 AND user_id = $2`,
        [noteId, session.user.id],
      )
      if (noteForDLP.rows.length > 0) {
        const note = noteForDLP.rows[0]
        const dlpResult = await checkDLPPolicy({
          orgId: note.org_id,
          action: "share_note",
          userId: session.user.id,
          content: `${note.topic || ""} ${note.content || ""} ${sanitizedBody.topic || ""} ${sanitizedBody.content || ""}`,
          sensitivityLevel: note.sensitivity_level,
        })
        if (!dlpResult.allowed) {
          return NextResponse.json({ error: dlpResult.reason }, { status: 403 })
        }
      }
    }

    const now = new Date().toISOString()

    const result = await db.query(
      `UPDATE personal_sticks SET
        title = COALESCE($1, title),
        topic = COALESCE($2, topic),
        content = COALESCE($3, content),
        color = COALESCE($4, color),
        position_x = COALESCE($5, position_x),
        position_y = COALESCE($6, position_y),
        is_shared = COALESCE($7, is_shared),
        updated_at = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        sanitizedBody.title ?? null,
        sanitizedBody.topic ?? null,
        sanitizedBody.content ?? null,
        sanitizedBody.color ?? null,
        sanitizedBody.position_x ?? null,
        sanitizedBody.position_y ?? null,
        sanitizedBody.is_shared ?? null,
        now,
        noteId,
        session.user.id
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Note not found or update failed" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error("PUT /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Partial update of note
// ============================================================================

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params
    const noteId = params.id

    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body, ["topic", "content"])

    // DLP check when sharing a note
    if (sanitizedBody.is_shared === true) {
      const noteForDLP = await db.query(
        `SELECT org_id, topic, content, sensitivity_level FROM personal_sticks WHERE id = $1 AND user_id = $2`,
        [noteId, session.user.id],
      )
      if (noteForDLP.rows.length > 0) {
        const note = noteForDLP.rows[0]
        const dlpResult = await checkDLPPolicy({
          orgId: note.org_id,
          action: "share_note",
          userId: session.user.id,
          content: `${note.topic || ""} ${note.content || ""} ${sanitizedBody.topic || ""} ${sanitizedBody.content || ""}`,
          sensitivityLevel: note.sensitivity_level,
        })
        if (!dlpResult.allowed) {
          return NextResponse.json({ error: dlpResult.reason }, { status: 403 })
        }
      }
    }

    const now = new Date().toISOString()

    const result = await db.query(
      `UPDATE personal_sticks SET
        title = COALESCE($1, title),
        topic = COALESCE($2, topic),
        content = COALESCE($3, content),
        color = COALESCE($4, color),
        position_x = COALESCE($5, position_x),
        position_y = COALESCE($6, position_y),
        is_shared = COALESCE($7, is_shared),
        updated_at = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        sanitizedBody.title ?? null,
        sanitizedBody.topic ?? null,
        sanitizedBody.content ?? null,
        sanitizedBody.color ?? null,
        sanitizedBody.position_x ?? null,
        sanitizedBody.position_y ?? null,
        sanitizedBody.is_shared ?? null,
        now,
        noteId,
        session.user.id
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error("PATCH /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete note
// ============================================================================

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params
    const noteId = params.id
    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    if (await isUnderLegalHold(session.user.id)) {
      return NextResponse.json({ error: "Content cannot be deleted: active legal hold" }, { status: 403 })
    }

    const result = await db.query(
      `DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2 RETURNING id`,
      [noteId, session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Note deleted successfully" })
  } catch (err) {
    console.error("DELETE /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

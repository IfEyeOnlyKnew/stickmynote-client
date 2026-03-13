// v2 Notes [id] API: production-quality, get, update, delete single note
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { checkDLPPolicy } from '@/lib/dlp/policy-checker'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id] - Get single note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

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

    // Get note
    const noteResult = await db.query(
      `SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const note = noteResult.rows[0]

    // Get tabs
    const tabsResult = await db.query(
      `SELECT tab_type, tab_data, tab_name, tags FROM personal_sticks_tabs WHERE personal_stick_id = $1`,
      [noteId]
    )

    let details = ''
    let videos: any[] = []
    let images: any[] = []
    let hyperlinks: any[] = []

    for (const tab of tabsResult.rows) {
      if (tab.tab_type === 'details' && tab.tab_data?.content) {
        details = tab.tab_data.content
      }
      if ((tab.tab_type === 'videos' || tab.tab_type === 'video') && tab.tab_data) {
        videos = Array.isArray(tab.tab_data) ? tab.tab_data : tab.tab_data.videos || []
      }
      if (tab.tab_type === 'images' && tab.tab_data) {
        images = Array.isArray(tab.tab_data) ? tab.tab_data : tab.tab_data.images || []
      }
      if (tab.tab_name === 'Tags' && tab.tags) {
        try {
          hyperlinks = Array.isArray(tab.tags)
            ? tab.tags
            : typeof tab.tags === 'string'
              ? JSON.parse(tab.tags || '[]')
              : []
        } catch {
          hyperlinks = []
        }
      }
    }

    // Get tags
    const tagsResult = await db.query(
      `SELECT tag_title FROM personal_sticks_tags WHERE personal_stick_id = $1 ORDER BY tag_order ASC`,
      [noteId]
    )
    const tags = tagsResult.rows.map((t: any) => t.tag_title)

    return new Response(
      JSON.stringify({
        ...note,
        details,
        tags,
        images,
        videos,
        hyperlinks,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[id] - Full update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

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

    const body = await request.json()

    // DLP check when sharing a note
    if (body.is_shared === true) {
      const noteForDLP = await db.query(
        `SELECT org_id, topic, content, sensitivity_level FROM personal_sticks WHERE id = $1 AND user_id = $2`,
        [noteId, user.id],
      )
      if (noteForDLP.rows.length > 0) {
        const note = noteForDLP.rows[0]
        const dlpResult = await checkDLPPolicy({
          orgId: note.org_id,
          action: 'share_note',
          userId: user.id,
          content: `${note.topic || ''} ${note.content || ''} ${body.topic || ''} ${body.content || ''}`,
          sensitivityLevel: note.sensitivity_level,
        })
        if (!dlpResult.allowed) {
          return new Response(JSON.stringify({ error: dlpResult.reason }), { status: 403 })
        }
      }
    }

    const result = await db.query(
      `UPDATE personal_sticks SET
        title = COALESCE($1, title),
        topic = COALESCE($2, topic),
        content = COALESCE($3, content),
        color = COALESCE($4, color),
        position_x = COALESCE($5, position_x),
        position_y = COALESCE($6, position_y),
        is_shared = COALESCE($7, is_shared),
        updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        body.title ?? null,
        body.topic ?? null,
        body.content ?? null,
        body.color ?? null,
        body.position_x ?? null,
        body.position_y ?? null,
        body.is_shared ?? null,
        noteId,
        user.id,
      ]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Broadcast update to user's other sessions
    const broadcast = (globalThis as any).__wsBroadcast
    broadcast?.sendToUser(user.id, {
      type: "note.updated",
      payload: result.rows[0],
      timestamp: Date.now(),
    })

    return new Response(JSON.stringify(result.rows[0]), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/notes/[id] - Partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

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

    const body = await request.json()

    // DLP check when sharing a note
    if (body.is_shared === true) {
      const noteForDLP = await db.query(
        `SELECT org_id, topic, content, sensitivity_level FROM personal_sticks WHERE id = $1 AND user_id = $2`,
        [noteId, user.id],
      )
      if (noteForDLP.rows.length > 0) {
        const note = noteForDLP.rows[0]
        const dlpResult = await checkDLPPolicy({
          orgId: note.org_id,
          action: 'share_note',
          userId: user.id,
          content: `${note.topic || ''} ${note.content || ''} ${body.topic || ''} ${body.content || ''}`,
          sensitivityLevel: note.sensitivity_level,
        })
        if (!dlpResult.allowed) {
          return new Response(JSON.stringify({ error: dlpResult.reason }), { status: 403 })
        }
      }
    }

    const result = await db.query(
      `UPDATE personal_sticks SET
        title = COALESCE($1, title),
        topic = COALESCE($2, topic),
        content = COALESCE($3, content),
        color = COALESCE($4, color),
        position_x = COALESCE($5, position_x),
        position_y = COALESCE($6, position_y),
        is_shared = COALESCE($7, is_shared),
        updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        body.title ?? null,
        body.topic ?? null,
        body.content ?? null,
        body.color ?? null,
        body.position_x ?? null,
        body.position_y ?? null,
        body.is_shared ?? null,
        noteId,
        user.id,
      ]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Broadcast update to user's other sessions
    const broadcast = (globalThis as any).__wsBroadcast
    broadcast?.sendToUser(user.id, {
      type: "note.updated",
      payload: result.rows[0],
      timestamp: Date.now(),
    })

    return new Response(JSON.stringify(result.rows[0]), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[id] - Delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

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

    if (await isUnderLegalHold(user.id)) {
      return new Response(JSON.stringify({ error: 'Content cannot be deleted: active legal hold' }), { status: 403 })
    }

    const result = await db.query(
      `DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2 RETURNING id`,
      [noteId, user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Broadcast deletion to user's other sessions
    const broadcast = (globalThis as any).__wsBroadcast
    broadcast?.sendToUser(user.id, {
      type: "note.deleted",
      payload: { id: result.rows[0].id },
      timestamp: Date.now(),
    })

    return new Response(JSON.stringify({ message: 'Note deleted successfully' }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

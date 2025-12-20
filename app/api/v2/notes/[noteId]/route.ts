// v2 Note Details API: production-quality CRUD for individual notes
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/notes/[noteId] - Get note details by ID
export async function GET(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId
    const note = await querySingle(
      `SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    )
    if (!note) return new Response(JSON.stringify({ error: 'Note not found or access denied' }), { status: 404 })
    return new Response(JSON.stringify({ note }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[noteId] - Update note
export async function PUT(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId
    const body = await request.json()

    const now = new Date().toISOString()
    const note = await querySingle(
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
        body.title ?? null,
        body.topic ?? null,
        body.content ?? null,
        body.color ?? null,
        body.position_x ?? null,
        body.position_y ?? null,
        body.is_shared ?? null,
        now,
        noteId,
        userId
      ]
    )

    if (!note) {
      return new Response(JSON.stringify({ error: 'Note not found or not owned by user' }), { status: 404 })
    }

    return new Response(JSON.stringify({ note }), { status: 200 })
  } catch (error) {
    console.error('[API] PUT /api/v2/notes/[noteId] error:', error)
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[noteId] - Delete note
export async function DELETE(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId

    const deleted = await querySingle(
      'DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2 RETURNING id',
      [noteId, userId]
    )

    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Note not found or not owned by user' }), { status: 404 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error('[API] DELETE /api/v2/notes/[noteId] error:', error)
    return handleApiError(error)
  }
}

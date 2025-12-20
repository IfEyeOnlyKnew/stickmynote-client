// v2 User Note Details API: production-quality, get note by user and note ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/notes/[noteId] - Get note details by user and note ID
export async function GET(request: NextRequest, { params }: { params: { userId: string, noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    const noteId = params.noteId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const note = await querySingle(
      `SELECT * FROM notes WHERE id = $1 AND owner_id = $2`,
      [noteId, userId]
    )
    if (!note) return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    return new Response(JSON.stringify({ note }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

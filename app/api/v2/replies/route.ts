// v2 Replies API: production-quality, manage replies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v2/replies - Fetch replies for a note
export async function GET(request: NextRequest) {
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('note_id')

    if (!noteId || !UUID_REGEX.test(noteId)) {
      return new Response(JSON.stringify({ error: 'Valid note ID is required' }), { status: 400 })
    }

    // Check note access
    const noteResult = await db.query(
      `SELECT user_id, is_shared, org_id FROM personal_sticks WHERE id = $1 AND org_id = $2`,
      [noteId, orgContext.orgId]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const note = noteResult.rows[0]
    if (note.user_id !== user.id && !note.is_shared) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }

    // Get replies with user info
    const repliesResult = await db.query(
      `SELECT r.*, u.username, u.email
       FROM personal_sticks_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.personal_stick_id = $1 AND r.org_id = $2
       ORDER BY r.created_at ASC`,
      [noteId, orgContext.orgId]
    )

    const replies = repliesResult.rows.map((r: any) => ({
      ...r,
      user: { username: r.username, email: r.email },
    }))

    return new Response(JSON.stringify({ replies }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/replies - Create a reply
export async function POST(request: NextRequest) {
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()
    const { note_id, content, color = '#ffffff' } = body

    if (!note_id || !UUID_REGEX.test(note_id)) {
      return new Response(JSON.stringify({ error: 'Valid note ID is required' }), { status: 400 })
    }

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 })
    }

    // Check note access
    const noteResult = await db.query(
      `SELECT user_id, is_shared, org_id FROM personal_sticks WHERE id = $1 AND org_id = $2`,
      [note_id, orgContext.orgId]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const note = noteResult.rows[0]
    if (note.user_id !== user.id && !note.is_shared) {
      return new Response(JSON.stringify({ error: 'Cannot reply to this note' }), { status: 403 })
    }

    // Create reply
    const replyResult = await db.query(
      `INSERT INTO personal_sticks_replies (personal_stick_id, content, color, user_id, org_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [note_id, content.trim(), color, user.id, orgContext.orgId]
    )

    return new Response(JSON.stringify({ reply: replyResult.rows[0] }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

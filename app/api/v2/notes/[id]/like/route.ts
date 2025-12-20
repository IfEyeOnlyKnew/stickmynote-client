// v2 Notes Like API: production-quality, toggle like status
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id]/like - Get like count and status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    const authResult = await getCachedAuthUser()
    const user = authResult.user

    // Get total like count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM personal_sticks_reactions
       WHERE personal_stick_id = $1 AND reaction_type = 'like'`,
      [noteId]
    )
    const likeCount = parseInt(countResult.rows[0]?.count || '0', 10)

    // Check if current user liked
    let isLiked = false
    if (user) {
      const userResult = await db.query(
        `SELECT id FROM personal_sticks_reactions
         WHERE personal_stick_id = $1 AND user_id = $2 AND reaction_type = 'like'`,
        [noteId, user.id]
      )
      isLiked = userResult.rows.length > 0
    }

    return new Response(JSON.stringify({ likeCount, isLiked }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[id]/like - Toggle like
export async function POST(
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

    // Check note exists and access
    const noteResult = await db.query(
      `SELECT id, user_id, is_shared FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const note = noteResult.rows[0]

    // Allow liking if: user owns the note OR note is shared
    if (note.user_id !== user.id && !note.is_shared) {
      return new Response(JSON.stringify({ error: 'Cannot like private notes' }), { status: 403 })
    }

    // Check existing like
    const existingResult = await db.query(
      `SELECT id FROM personal_sticks_reactions
       WHERE personal_stick_id = $1 AND user_id = $2 AND reaction_type = 'like'`,
      [noteId, user.id]
    )

    if (existingResult.rows.length > 0) {
      // Unlike
      await db.query(
        `DELETE FROM personal_sticks_reactions WHERE id = $1`,
        [existingResult.rows[0].id]
      )
      return new Response(JSON.stringify({ success: true, liked: false }), { status: 200 })
    } else {
      // Like
      await db.query(
        `INSERT INTO personal_sticks_reactions (personal_stick_id, user_id, reaction_type)
         VALUES ($1, $2, 'like')`,
        [noteId, user.id]
      )
      return new Response(JSON.stringify({ success: true, liked: true }), { status: 200 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

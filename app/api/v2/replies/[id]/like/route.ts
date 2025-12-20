// v2 Replies Like API: production-quality, toggle like on reply
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/replies/[id]/like - Get like count and status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: replyId } = await params

    // Get total like count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM reply_reactions
       WHERE reply_id = $1 AND reaction_type = 'like'`,
      [replyId]
    )
    const likeCount = parseInt(countResult.rows[0]?.count || '0', 10)

    // Check if current user liked
    const authResult = await getCachedAuthUser()
    let isLiked = false

    if (authResult.user && !authResult.rateLimited) {
      const userResult = await db.query(
        `SELECT id FROM reply_reactions
         WHERE reply_id = $1 AND user_id = $2 AND reaction_type = 'like'`,
        [replyId, authResult.user.id]
      )
      isLiked = userResult.rows.length > 0
    }

    return new Response(JSON.stringify({ likeCount, isLiked }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/replies/[id]/like - Toggle like
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: replyId } = await params

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

    // Check existing like
    const existingResult = await db.query(
      `SELECT id FROM reply_reactions
       WHERE reply_id = $1 AND user_id = $2 AND reaction_type = 'like'`,
      [replyId, user.id]
    )

    if (existingResult.rows.length > 0) {
      // Unlike - delete the reaction
      await db.query(`DELETE FROM reply_reactions WHERE id = $1`, [existingResult.rows[0].id])
      return new Response(JSON.stringify({ success: true, liked: false }), { status: 200 })
    } else {
      // Like - insert a reaction
      await db.query(
        `INSERT INTO reply_reactions (reply_id, user_id, reaction_type)
         VALUES ($1, $2, 'like')`,
        [replyId, user.id]
      )
      return new Response(JSON.stringify({ success: true, liked: true }), { status: 200 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

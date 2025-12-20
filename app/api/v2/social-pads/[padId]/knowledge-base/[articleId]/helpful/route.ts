// v2 Social Pads KB Article Helpful API: production-quality, vote articles as helpful
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-pads/[padId]/knowledge-base/[articleId]/helpful - Mark as helpful
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; articleId: string }> }
) {
  try {
    const { articleId } = await params

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

    // Check if already voted
    const existingResult = await db.query(
      `SELECT id FROM social_kb_helpful_votes
       WHERE kb_article_id = $1 AND user_id = $2`,
      [articleId, user.id]
    )

    if (existingResult.rows.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Already marked as helpful' }),
        { status: 400 }
      )
    }

    // Insert vote
    await db.query(
      `INSERT INTO social_kb_helpful_votes (kb_article_id, user_id) VALUES ($1, $2)`,
      [articleId, user.id]
    )

    // Update helpful count
    await db.query(
      `UPDATE social_pad_knowledge_base
       SET helpful_count = COALESCE(helpful_count, 0) + 1
       WHERE id = $1`,
      [articleId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-pads/[padId]/knowledge-base/[articleId]/helpful - Remove helpful vote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; articleId: string }> }
) {
  try {
    const { articleId } = await params

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

    const deleteResult = await db.query(
      `DELETE FROM social_kb_helpful_votes
       WHERE kb_article_id = $1 AND user_id = $2
       RETURNING id`,
      [articleId, user.id]
    )

    if (deleteResult.rows.length > 0) {
      // Decrement helpful count
      await db.query(
        `UPDATE social_pad_knowledge_base
         SET helpful_count = GREATEST(COALESCE(helpful_count, 0) - 1, 0)
         WHERE id = $1`,
        [articleId]
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

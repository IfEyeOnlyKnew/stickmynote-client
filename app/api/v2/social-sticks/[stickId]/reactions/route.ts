// v2 Social Sticks [stickId] Reactions API: production-quality, manage stick reactions
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-sticks/[stickId]/reactions - Get reactions for stick
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    // Get reactions with user data
    const result = await db.query(
      `SELECT r.*, u.id as uid, u.full_name, u.username, u.avatar_url
       FROM social_stick_reactions r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.social_stick_id = $1
       ORDER BY r.created_at DESC`,
      [stickId]
    )

    const reactions = result.rows.map((r: any) => ({
      ...r,
      users: {
        id: r.uid,
        full_name: r.full_name,
        username: r.username,
        avatar_url: r.avatar_url,
      },
    }))

    // Aggregate reaction counts by type
    const reactionCounts: Record<string, number> = {}
    for (const reaction of reactions) {
      reactionCounts[reaction.reaction_type] = (reactionCounts[reaction.reaction_type] || 0) + 1
    }

    return new Response(JSON.stringify({ reactions, reactionCounts }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/social-sticks/[stickId]/reactions - Toggle reaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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
    const { reaction_type } = body

    // Check if reaction exists
    const existingResult = await db.query(
      `SELECT id FROM social_stick_reactions
       WHERE social_stick_id = $1 AND user_id = $2 AND reaction_type = $3`,
      [stickId, user.id, reaction_type]
    )

    if (existingResult.rows.length > 0) {
      // Remove existing reaction (toggle off)
      await db.query(
        `DELETE FROM social_stick_reactions WHERE id = $1`,
        [existingResult.rows[0].id]
      )
      return new Response(
        JSON.stringify({ removed: true, reactionType: reaction_type }),
        { status: 200 }
      )
    }

    // Add new reaction
    const insertResult = await db.query(
      `INSERT INTO social_stick_reactions (social_stick_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [stickId, user.id, reaction_type]
    )

    return new Response(
      JSON.stringify({ reaction: insertResult.rows[0], added: true }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-sticks/[stickId]/reactions - Remove reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const { searchParams } = new URL(request.url)
    const reactionType = searchParams.get('reactionType')

    if (!reactionType) {
      return new Response(JSON.stringify({ error: 'Reaction type is required' }), { status: 400 })
    }

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

    await db.query(
      `DELETE FROM social_stick_reactions
       WHERE social_stick_id = $1 AND user_id = $2 AND reaction_type = $3`,
      [stickId, user.id, reactionType]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Sticks Reactions API: production-quality, list all reactions in org
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-sticks/reactions - Get all reactions in org
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ reactions: [] }), { status: 200 })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ reactions: [] }), { status: 200 })
    }
    const user = authResult.user

    // Get user's organization
    const membershipResult = await db.query(
      `SELECT org_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [user.id]
    )

    if (membershipResult.rows.length === 0) {
      return new Response(JSON.stringify({ reactions: [] }), { status: 200 })
    }

    const orgId = membershipResult.rows[0].org_id

    // Get all reactions for sticks in org
    const reactionsResult = await db.query(
      `SELECT id, social_stick_id, user_id, reaction_type, created_at
       FROM social_stick_reactions
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [orgId]
    )

    return new Response(
      JSON.stringify({ reactions: reactionsResult.rows }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

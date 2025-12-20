// v2 Social Pads Stick Replies API: production-quality, get replies for a stick
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-pads/[padId]/sticks/[stickId]/replies - Get replies for a stick
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; stickId: string }> }
) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    // Note: This route allows unauthenticated access for public content
    const user = authResult.user

    let orgId: string | null = null
    if (user) {
      const orgContext = await getOrgContext()
      orgId = orgContext?.orgId || null
    }

    // Build query
    let query = `SELECT * FROM social_stick_replies WHERE stick_id = $1`
    const queryParams: any[] = [stickId]

    if (orgId) {
      query += ` AND org_id = $2`
      queryParams.push(orgId)
    }

    query += ` ORDER BY created_at ASC`

    const repliesResult = await db.query(query, queryParams)
    const replies = repliesResult.rows

    if (replies.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 })
    }

    // Get unique user IDs
    const userIds = [...new Set(replies.map((r: any) => r.user_id).filter(Boolean))]

    if (userIds.length === 0) {
      return new Response(JSON.stringify(replies), { status: 200 })
    }

    // Get user info
    const usersResult = await db.query(
      `SELECT id, email, full_name, avatar_url, username FROM users WHERE id = ANY($1)`,
      [userIds]
    )

    const usersMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))

    // Combine replies with user info
    const repliesWithUsers = replies.map((reply: any) => ({
      ...reply,
      user: usersMap.get(reply.user_id) || {
        id: reply.user_id,
        email: null,
        full_name: null,
        avatar_url: null,
        username: null,
      },
    }))

    return new Response(JSON.stringify(repliesWithUsers), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

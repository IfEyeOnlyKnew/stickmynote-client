// v2 Social Pads Sticks API: production-quality, get sticks for a pad
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-pads/[padId]/sticks - Get sticks for a pad
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    // Get sticks
    const sticksResult = await db.query(
      `SELECT * FROM social_sticks
       WHERE social_pad_id = $1
       ORDER BY created_at DESC`,
      [padId]
    )

    const sticks = sticksResult.rows

    if (sticks.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 })
    }

    // Get unique user IDs
    const userIds = [...new Set(sticks.map((s: any) => s.user_id).filter(Boolean))]

    if (userIds.length === 0) {
      return new Response(JSON.stringify(sticks), { status: 200 })
    }

    // Get user info
    const usersResult = await db.query(
      `SELECT id, email, full_name, avatar_url, username FROM users WHERE id = ANY($1)`,
      [userIds]
    )

    const usersMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))

    // Combine sticks with user info
    const sticksWithUsers = sticks.map((stick: any) => ({
      ...stick,
      user: usersMap.get(stick.user_id) || {
        id: stick.user_id,
        email: null,
        full_name: null,
        avatar_url: null,
        username: null,
      },
    }))

    return new Response(JSON.stringify(sticksWithUsers), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

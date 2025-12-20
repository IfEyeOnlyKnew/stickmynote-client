// v2 Sticks CalSticks API: production-quality, get CalStick replies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/sticks/[id]/calsticks - Get CalStick replies for stick
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

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

    const repliesResult = await db.query(
      `SELECT id, content, is_calstick, calstick_date, calstick_completed, created_at, stick_id
       FROM paks_pad_stick_replies
       WHERE stick_id = $1 AND is_calstick = true
       ORDER BY calstick_date ASC`,
      [stickId]
    )

    const replies = repliesResult.rows
    const completed = replies.filter((r: any) => r.calstick_completed).length
    const notCompleted = replies.filter((r: any) => !r.calstick_completed).length

    return new Response(
      JSON.stringify({
        calsticks: replies,
        counts: {
          completed,
          notCompleted,
          total: replies.length,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

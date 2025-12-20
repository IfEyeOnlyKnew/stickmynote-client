// v2 Activity API: production-quality, user/org activity feed
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/activity - List recent activity for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
    const activity = await query(
      `SELECT * FROM activity_log WHERE (user_id = $1 OR org_id = $2)
       ORDER BY timestamp DESC LIMIT $3`,
      [userId, orgId, limit]
    )
    return new Response(JSON.stringify({ activity }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

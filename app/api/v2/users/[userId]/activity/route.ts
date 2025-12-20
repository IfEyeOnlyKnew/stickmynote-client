// v2 User Activity API: production-quality, list activity for a user
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/activity - List activity for a user
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
    const activity = await query(
      `SELECT * FROM activity_log WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [userId, limit]
    )
    return new Response(JSON.stringify({ activity }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

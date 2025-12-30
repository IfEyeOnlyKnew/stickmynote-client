// v2 User Calsticks API: production-quality, list calendar stick events for a user
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/calsticks - List calendar stick events for a user
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params
    const session = await requireADSession(request)
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const events = await query(
      `SELECT * FROM calsticks WHERE user_id = $1 ORDER BY start_time DESC`,
      [userId]
    )
    return new Response(JSON.stringify({ events }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

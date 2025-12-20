// v2 User Uploads API: production-quality, list uploads for a user
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/uploads - List uploads for a user
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const uploads = await query(
      `SELECT * FROM uploads WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    return new Response(JSON.stringify({ uploads }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 User Multipaks API: production-quality, list multipaks for a user
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/multipaks - List multipaks for a user
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const multipaks = await query(
      `SELECT * FROM multipaks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    return new Response(JSON.stringify({ multipaks }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

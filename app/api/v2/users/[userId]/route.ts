// v2 User Details API: production-quality, get user by ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId] - Get user details by ID
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const user = await querySingle(
      `SELECT id, display_name, email, created_at, last_login_at FROM users WHERE id = $1`,
      [userId]
    )
    if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    return new Response(JSON.stringify({ user }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

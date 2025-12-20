// v2 User API: Profile, accessible pads, production-quality
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/user/me - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    // Fetch user profile
    const user = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    )
    return new Response(JSON.stringify({ user: user[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

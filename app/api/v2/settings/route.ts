// v2 Settings API: production-quality, get/set user settings
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query, querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'
import { requireOptionalString } from '@/lib/api/validate'

// GET /api/v2/settings - Get user settings
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const settings = await querySingle(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [userId]
    )
    return new Response(JSON.stringify({ settings }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/settings - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const body = await request.json()
    const theme = requireOptionalString(body.theme)
    const notifications = typeof body.notifications === 'boolean' ? body.notifications : undefined
    const settings = await querySingle(
      `UPDATE user_settings SET
        theme = COALESCE($1, theme),
        notifications = COALESCE($2, notifications)
       WHERE user_id = $3
       RETURNING *`,
      [theme, notifications, userId]
    )
    return new Response(JSON.stringify({ settings }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

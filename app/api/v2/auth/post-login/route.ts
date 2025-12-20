// v2 Auth Post Login API: production-quality, post-login processing
import { getSession } from '@/lib/auth/local-auth'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/post-login - Process post-login actions
// Updates login count and determines redirect based on user role
export async function POST() {
  try {
    const session = await getSession()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }

    const userId = session.user.id

    // Get current user data including login_count
    const userResult = await db.query(
      `SELECT id, email, login_count, hub_mode FROM users WHERE id = $1`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }

    const user = userResult.rows[0]
    const currentLoginCount = user.login_count || 0
    const isFirstLogin = currentLoginCount === 0

    // Update login count and last_login_at
    await db.query(
      `UPDATE users
       SET login_count = login_count + 1,
           last_login_at = NOW(),
           hub_mode = 'full_access'
       WHERE id = $1`,
      [userId]
    )

    // Check if user is an organization owner
    const membershipResult = await db.query(
      `SELECT role FROM organization_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
      [userId]
    )

    const isOwner = membershipResult.rows.length > 0

    // Determine redirect path
    let redirect = '/dashboard'

    // If this is the owner's first login, redirect to organization settings
    if (isFirstLogin && isOwner) {
      redirect = '/settings/organization'
    }

    return new Response(
      JSON.stringify({
        success: true,
        redirect,
        isFirstLogin,
        isOwner,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

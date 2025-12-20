// v2 Admin Unlock Account API: production-quality, unlock locked user accounts
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/admin/unlock-account - Unlock a locked user account
export async function POST(request: NextRequest) {
  try {
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
    const user = authResult.user

    // Check if user is an organization owner
    const membershipResult = await db.query(
      `SELECT role, org_id FROM organization_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
      [user.id]
    )

    if (membershipResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Only organization owners can unlock accounts' }),
        { status: 403 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Delete failed login attempts to unlock the account
    await db.query(`DELETE FROM login_attempts WHERE email = $1 AND success = false`, [
      normalizedEmail,
    ])

    // Also clear from account_lockouts table
    await db.query(`DELETE FROM account_lockouts WHERE email = $1`, [normalizedEmail])

    return new Response(
      JSON.stringify({ success: true, message: `Account ${email} has been unlocked` }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

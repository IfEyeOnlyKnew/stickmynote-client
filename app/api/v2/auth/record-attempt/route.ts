// v2 Auth Record Attempt API: production-quality, record login attempt
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/record-attempt - Record login attempt (success/failure)
export async function POST(request: NextRequest) {
  try {
    const { email, success, ipAddress } = await request.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Get organization settings for lockout config
    // First, try to find user's organization
    let maxAttempts = 5
    let lockoutMinutes = 15

    const userResult = await db.query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail])
    const user = userResult.rows[0]

    if (user) {
      const membershipResult = await db.query(
        `SELECT om.org_id, o.max_failed_attempts, o.lockout_duration_minutes
         FROM organization_members om
         JOIN organizations o ON o.id = om.org_id
         WHERE om.user_id = $1 AND om.status = 'active'
         LIMIT 1`,
        [user.id]
      )

      const membership = membershipResult.rows[0]
      if (membership) {
        maxAttempts = membership.max_failed_attempts ?? 5
        lockoutMinutes = membership.lockout_duration_minutes ?? 15
      }
    }

    if (success) {
      // Clear lockout on successful login
      await db.query(`DELETE FROM account_lockouts WHERE email = $1`, [normalizedEmail])

      return new Response(JSON.stringify({ success: true, cleared: true }), { status: 200 })
    }

    // Failed attempt - increment counter
    const existingResult = await db.query(`SELECT * FROM account_lockouts WHERE email = $1`, [
      normalizedEmail,
    ])
    const existing = existingResult.rows[0]

    const now = new Date()
    let newAttempts = 1
    let lockedUntil: string | null = null

    if (existing) {
      // Check if previous lockout has expired
      if (existing.locked_until && new Date(existing.locked_until) < now) {
        // Reset counter if lockout expired (newAttempts already initialized to 1)
      } else {
        newAttempts = (existing.failed_attempts || 0) + 1
      }
    }

    // Lock account if max attempts reached
    if (newAttempts >= maxAttempts) {
      const lockUntilDate = new Date(now.getTime() + lockoutMinutes * 60000)
      lockedUntil = lockUntilDate.toISOString()
    }

    // Update or insert the lockout record
    if (existing) {
      await db.query(
        `UPDATE account_lockouts
         SET ip_address = $1,
             failed_attempts = $2,
             last_failed_at = $3,
             locked_until = $4,
             updated_at = $5
         WHERE email = $6`,
        [ipAddress || null, newAttempts, now.toISOString(), lockedUntil, now.toISOString(), normalizedEmail]
      )
    } else {
      await db.query(
        `INSERT INTO account_lockouts (email, ip_address, failed_attempts, last_failed_at, locked_until, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [normalizedEmail, ipAddress || null, newAttempts, now.toISOString(), lockedUntil, now.toISOString()]
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        failedAttempts: newAttempts,
        maxAttempts,
        locked: lockedUntil !== null,
        lockedUntil,
        remainingAttempts: Math.max(0, maxAttempts - newAttempts),
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

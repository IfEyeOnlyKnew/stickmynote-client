import { db } from "@/lib/database/pg-client"

export interface LockoutStatus {
  locked: boolean
  remainingMinutes?: number
  failedAttempts: number
  lockedUntil?: string
}

export interface RecordAttemptResult {
  success: boolean
  cleared?: boolean
  failedAttempts?: number
  maxAttempts?: number
  locked?: boolean
  lockedUntil?: string | null
  remainingAttempts?: number
}

/**
 * Check if an account is locked out due to failed login attempts
 * Direct database call - use this instead of fetch() for internal API calls
 */
export async function checkLockout(email: string): Promise<LockoutStatus> {
  const normalizedEmail = email.toLowerCase().trim()

  const result = await db.query(
    `SELECT * FROM account_lockouts WHERE email = $1`,
    [normalizedEmail]
  )

  const lockout = result.rows[0]

  if (lockout?.locked_until) {
    const lockedUntil = new Date(lockout.locked_until)
    const now = new Date()

    if (lockedUntil > now) {
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)
      return {
        locked: true,
        remainingMinutes,
        failedAttempts: lockout.failed_attempts,
        lockedUntil: lockout.locked_until,
      }
    }
  }

  return {
    locked: false,
    failedAttempts: lockout?.failed_attempts || 0,
  }
}

/**
 * Record a login attempt (success or failure)
 * Direct database call - use this instead of fetch() for internal API calls
 */
export async function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress?: string | null
): Promise<RecordAttemptResult> {
  const normalizedEmail = email.toLowerCase().trim()

  // Get organization settings for lockout config
  let maxAttempts = 5
  let lockoutMinutes = 15

  const userResult = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [normalizedEmail]
  )
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
    return { success: true, cleared: true }
  }

  // Failed attempt - increment counter
  const existingResult = await db.query(
    `SELECT * FROM account_lockouts WHERE email = $1`,
    [normalizedEmail]
  )
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

  return {
    success: true,
    failedAttempts: newAttempts,
    maxAttempts,
    locked: lockedUntil !== null,
    lockedUntil,
    remainingAttempts: Math.max(0, maxAttempts - newAttempts),
  }
}

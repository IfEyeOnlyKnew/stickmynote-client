// Auth handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'
import { signUp, createToken } from '@/lib/auth/local-auth'
import { cookies } from 'next/headers'

// ============================================================================
// Signup: Profile update helper
// ============================================================================

export interface ProfileFields {
  username?: string
  phone?: string
  location?: string
  bio?: string
  website?: string
  avatarUrl?: string
}

export async function updateUserProfile(userId: string, fields: ProfileFields): Promise<void> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (fields.username?.trim()) {
    updates.push(`username = $${paramIndex++}`)
    values.push(fields.username.trim())
  }
  if (fields.phone?.trim()) {
    updates.push(`phone = $${paramIndex++}`)
    values.push(fields.phone.trim())
  }
  if (fields.location?.trim()) {
    updates.push(`location = $${paramIndex++}`)
    values.push(fields.location.trim())
  }
  if (fields.bio?.trim()) {
    updates.push(`bio = $${paramIndex++}`)
    values.push(fields.bio.trim())
  }
  if (fields.website?.trim()) {
    updates.push(`website = $${paramIndex++}`)
    values.push(fields.website.trim())
  }
  if (fields.avatarUrl?.trim()) {
    updates.push(`avatar_url = $${paramIndex++}`)
    values.push(fields.avatarUrl.trim())
  }

  if (updates.length > 0) {
    values.push(userId)
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values)
  }
}

// ============================================================================
// Signup: Create user and set session
// ============================================================================

export interface SignupInput {
  email: string
  password: string
  fullName: string
  username?: string
  phone?: string
  location?: string
  bio?: string
  website?: string
  avatarUrl?: string
}

export async function handleSignup(input: SignupInput) {
  const { email, password, fullName, username, phone, location, bio, website, avatarUrl } = input

  if (!email || !password) {
    return { error: 'Email and password are required', status: 400 }
  }

  if (!fullName?.trim()) {
    return { error: 'Full name is required', status: 400 }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long', status: 400 }
  }

  // Check if email already exists
  const existingUser = await db.query(`SELECT id FROM users WHERE email = $1`, [
    email.trim().toLowerCase(),
  ])

  if (existingUser.rows.length > 0) {
    return { error: 'An account with this email already exists', status: 409 }
  }

  // Create user with local auth
  const result = await signUp(email, password, fullName)

  if (result.error || !result.user) {
    return { error: result.error || 'Failed to create account', status: 500 }
  }

  // Update additional user profile fields if provided
  if (username || phone || location || bio || website || avatarUrl) {
    try {
      await updateUserProfile(result.user.id, { username, phone, location, bio, website, avatarUrl })
    } catch (profileError) {
      console.error('Error updating profile:', profileError)
      // Continue - profile updates are non-critical
    }
  }

  // Create token for immediate sign-in
  const token = await createToken(result.user.id)

  // Set auth cookie
  const cookieStore = cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return {
    data: {
      success: true,
      user: result.user,
      session: { user: result.user },
    },
    status: 200,
  }
}

// ============================================================================
// Record attempt: Track login success/failure
// ============================================================================

export interface RecordAttemptInput {
  email: string
  success: boolean
  ipAddress?: string
}

export async function recordLoginAttempt(input: RecordAttemptInput) {
  const { email, success, ipAddress } = input

  if (!email) {
    return { error: 'Email required', status: 400 }
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Get organization settings for lockout config
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
      [user.id],
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

    return { data: { success: true, cleared: true }, status: 200 }
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
      [
        ipAddress || null,
        newAttempts,
        now.toISOString(),
        lockedUntil,
        now.toISOString(),
        normalizedEmail,
      ],
    )
  } else {
    await db.query(
      `INSERT INTO account_lockouts (email, ip_address, failed_attempts, last_failed_at, locked_until, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        normalizedEmail,
        ipAddress || null,
        newAttempts,
        now.toISOString(),
        lockedUntil,
        now.toISOString(),
      ],
    )
  }

  return {
    data: {
      success: true,
      failedAttempts: newAttempts,
      maxAttempts,
      locked: lockedUntil !== null,
      lockedUntil,
      remainingAttempts: Math.max(0, maxAttempts - newAttempts),
    },
    status: 200,
  }
}

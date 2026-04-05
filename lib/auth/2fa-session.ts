// Two-Factor Authentication Session Management
// Handles temporary verification sessions during sign-in

import "server-only"
import { db } from "@/lib/database/pg-client"
import crypto from "node:crypto"

export interface VerificationSession {
  id: string
  user_id: string
  session_token_hash: string
  verification_attempts: number
  max_attempts: number
  completed: boolean
  expires_at: string
}

const SESSION_EXPIRY_MINUTES = 5
const MAX_VERIFICATION_ATTEMPTS = 5

/**
 * Create a temporary 2FA verification session
 * Returns a session token that the client will use to verify their 2FA code
 */
export async function createVerificationSession(
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<{ sessionToken: string; expiresAt: Date }> {
  // Generate random session token
  const sessionToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000)

  // Store session
  await db.query(
    `INSERT INTO twofa_verification_sessions
     (user_id, session_token_hash, ip_address, user_agent, max_attempts, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      tokenHash,
      ipAddress || null,
      userAgent || null,
      MAX_VERIFICATION_ATTEMPTS,
      expiresAt,
    ]
  )

  return { sessionToken, expiresAt }
}

/**
 * Get verification session by token
 * Returns null if session doesn't exist, is completed, or has expired
 */
export async function getVerificationSession(
  sessionToken: string
): Promise<VerificationSession | null> {
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

  const result = await db.query<VerificationSession>(
    `SELECT * FROM twofa_verification_sessions
     WHERE session_token_hash = $1 AND completed = false AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  )

  return result.rows[0] || null
}

/**
 * Increment verification attempt counter
 * Returns current attempt count and whether max attempts has been exceeded
 */
export async function incrementVerificationAttempt(
  sessionToken: string
): Promise<{ attempts: number; maxAttempts: number; exceeded: boolean }> {
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

  const result = await db.query(
    `UPDATE twofa_verification_sessions
     SET verification_attempts = verification_attempts + 1
     WHERE session_token_hash = $1
     RETURNING verification_attempts, max_attempts`,
    [tokenHash]
  )

  if (result.rows.length === 0) {
    return { attempts: 0, maxAttempts: 0, exceeded: true }
  }

  const { verification_attempts, max_attempts } = result.rows[0]

  return {
    attempts: verification_attempts,
    maxAttempts: max_attempts,
    exceeded: verification_attempts >= max_attempts,
  }
}

/**
 * Mark session as completed
 * Called after successful 2FA verification
 */
export async function completeVerificationSession(sessionToken: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

  await db.query(
    `UPDATE twofa_verification_sessions
     SET completed = true
     WHERE session_token_hash = $1`,
    [tokenHash]
  )
}

/**
 * Invalidate all verification sessions for a user
 * Useful when disabling 2FA or for security purposes
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.query(`DELETE FROM twofa_verification_sessions WHERE user_id = $1`, [userId])
}

/**
 * Cleanup expired sessions
 * Should be called periodically (e.g., via cron job)
 * Returns the number of sessions deleted
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.query(
    `DELETE FROM twofa_verification_sessions
     WHERE expires_at < NOW() - INTERVAL '1 hour'`
  )

  return result.rowCount || 0
}

// Two-Factor Authentication Library
// Provides TOTP generation, verification, and backup code management

import "server-only"
import { TOTP, Secret } from "otpauth"
import { db } from "@/lib/database/pg-client"
import { encryptForOrg, decryptForOrg } from "@/lib/encryption"
import crypto from "crypto"

// ==================== TYPES ====================

export interface TwoFactorSecret {
  id: string
  user_id: string
  org_id: string
  method: "totp" | "sms" | "fido2"
  encrypted_secret: string | null
  backup_codes_encrypted: any | null
  backup_codes_used: any
  enabled: boolean
  verified: boolean
  enabled_at: string | null
  last_used_at: string | null
}

export interface SetupResult {
  secret: string // Base32-encoded secret (for manual entry)
  qrCodeUri: string // otpauth:// URI for QR code
  backupCodes: string[] // Plain text backup codes (show once)
}

export interface VerificationResult {
  success: boolean
  method?: "totp" | "backup_code"
  error?: string
}

// ==================== TOTP CONFIGURATION ====================

const TOTP_CONFIG = {
  issuer: "Stick My Note",
  algorithm: "SHA1" as const,
  digits: 6,
  period: 30,
  window: 1, // Allow 1 step before/after (±30 seconds)
}

const BACKUP_CODE_COUNT = 10
const BACKUP_CODE_LENGTH = 8

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate cryptographically secure backup codes
 */
function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString("hex").toUpperCase()
    // Format as XXXX-XXXX
    const formatted = `${code.substring(0, 4)}-${code.substring(4, 8)}`
    codes.push(formatted)
  }
  return codes
}

/**
 * Hash backup code for storage (using SHA-256)
 */
function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.replace("-", "")).digest("hex")
}

/**
 * Check if backup code matches any unused code
 */
async function verifyBackupCode(
  code: string,
  encryptedCodes: string[],
  usedHashes: string[],
  orgId: string
): Promise<{ valid: boolean; matchedHash?: string }> {
  const inputHash = hashBackupCode(code)

  // Check if already used
  if (usedHashes.includes(inputHash)) {
    return { valid: false }
  }

  // Decrypt and compare all backup codes
  for (const encrypted of encryptedCodes) {
    const decrypted = await decryptForOrg(encrypted, orgId)
    const hash = hashBackupCode(decrypted)

    if (hash === inputHash) {
      return { valid: true, matchedHash: inputHash }
    }
  }

  return { valid: false }
}

// ==================== PUBLIC API ====================

/**
 * Initialize 2FA setup for a user
 * Returns secret and QR code URI, generates backup codes
 */
export async function initiate2FASetup(
  userId: string,
  orgId: string,
  userEmail: string
): Promise<SetupResult> {
  // Generate TOTP secret
  const secret = new Secret({ size: 20 }) // 160 bits
  const totp = new TOTP({
    issuer: TOTP_CONFIG.issuer,
    label: userEmail,
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period,
    secret,
  })

  // Generate backup codes
  const backupCodes = generateBackupCodes()

  // Encrypt secret and backup codes
  const encryptedSecret = await encryptForOrg(secret.base32, orgId)
  const encryptedBackupCodes = await Promise.all(
    backupCodes.map((code) => encryptForOrg(code, orgId))
  )

  // Store in database (not enabled yet, waiting for verification)
  await db.query(
    `INSERT INTO user_2fa_secrets
     (user_id, org_id, method, encrypted_secret, backup_codes_encrypted, enabled, verified)
     VALUES ($1, $2, 'totp', $3, $4, false, false)
     ON CONFLICT (user_id, method)
     DO UPDATE SET
       encrypted_secret = EXCLUDED.encrypted_secret,
       backup_codes_encrypted = EXCLUDED.backup_codes_encrypted,
       backup_codes_used = '[]'::jsonb,
       enabled = false,
       verified = false,
       updated_at = NOW()`,
    [userId, orgId, encryptedSecret, JSON.stringify(encryptedBackupCodes)]
  )

  // Audit log
  await db.query(
    `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success)
     VALUES ($1, $2, 'setup_started', 'totp', true)`,
    [userId, orgId]
  )

  return {
    secret: secret.base32,
    qrCodeUri: totp.toString(),
    backupCodes,
  }
}

/**
 * Verify TOTP code and enable 2FA
 */
export async function verify2FASetup(
  userId: string,
  orgId: string,
  code: string,
  ipAddress?: string | null
): Promise<VerificationResult> {
  // Get the pending secret
  const result = await db.query<TwoFactorSecret>(
    `SELECT * FROM user_2fa_secrets
     WHERE user_id = $1 AND method = 'totp' AND enabled = false
     LIMIT 1`,
    [userId]
  )

  if (result.rows.length === 0) {
    return { success: false, error: "No pending 2FA setup found" }
  }

  const secretRecord = result.rows[0]
  if (!secretRecord.encrypted_secret) {
    return { success: false, error: "Invalid 2FA configuration" }
  }

  // Decrypt secret
  const secretBase32 = await decryptForOrg(secretRecord.encrypted_secret, orgId)
  const secret = Secret.fromBase32(secretBase32)

  // Create TOTP instance
  const totp = new TOTP({
    issuer: TOTP_CONFIG.issuer,
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period,
    secret,
  })

  // Verify code (with time window)
  const delta = totp.validate({ token: code, window: TOTP_CONFIG.window })

  if (delta === null) {
    // Audit failed verification
    await db.query(
      `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, failure_reason, ip_address)
       VALUES ($1, $2, 'verification_failed', 'totp', false, 'Invalid code during setup', $3)`,
      [userId, orgId, ipAddress || null]
    )

    return { success: false, error: "Invalid verification code" }
  }

  // Enable 2FA
  await db.query(
    `UPDATE user_2fa_secrets
     SET enabled = true, verified = true, enabled_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND method = 'totp'`,
    [userId]
  )

  // Audit success
  await db.query(
    `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, ip_address)
     VALUES ($1, $2, 'enabled', 'totp', true, $3)`,
    [userId, orgId, ipAddress || null]
  )

  return { success: true, method: "totp" }
}

/**
 * Verify 2FA code during sign-in (TOTP or backup code)
 */
export async function verify2FACode(
  userId: string,
  orgId: string,
  code: string,
  ipAddress?: string | null
): Promise<VerificationResult> {
  // Get enabled 2FA secret
  const result = await db.query<TwoFactorSecret>(
    `SELECT * FROM user_2fa_secrets
     WHERE user_id = $1 AND method = 'totp' AND enabled = true
     LIMIT 1`,
    [userId]
  )

  if (result.rows.length === 0) {
    return { success: false, error: "2FA not enabled" }
  }

  const secretRecord = result.rows[0]

  // Try TOTP first
  if (secretRecord.encrypted_secret) {
    const secretBase32 = await decryptForOrg(secretRecord.encrypted_secret, orgId)
    const secret = Secret.fromBase32(secretBase32)

    const totp = new TOTP({
      issuer: TOTP_CONFIG.issuer,
      algorithm: TOTP_CONFIG.algorithm,
      digits: TOTP_CONFIG.digits,
      period: TOTP_CONFIG.period,
      secret,
    })

    const delta = totp.validate({ token: code, window: TOTP_CONFIG.window })

    if (delta !== null) {
      // Update last used timestamp
      await db.query(
        `UPDATE user_2fa_secrets SET last_used_at = NOW() WHERE id = $1`,
        [secretRecord.id]
      )

      // Audit success
      await db.query(
        `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, ip_address)
         VALUES ($1, $2, 'verified', 'totp', true, $3)`,
        [userId, orgId, ipAddress || null]
      )

      return { success: true, method: "totp" }
    }
  }

  // Try backup codes if TOTP failed
  if (secretRecord.backup_codes_encrypted) {
    const encryptedCodes = JSON.parse(
      typeof secretRecord.backup_codes_encrypted === "string"
        ? secretRecord.backup_codes_encrypted
        : JSON.stringify(secretRecord.backup_codes_encrypted)
    ) as string[]
    const usedHashes = Array.isArray(secretRecord.backup_codes_used)
      ? secretRecord.backup_codes_used
      : JSON.parse(
          typeof secretRecord.backup_codes_used === "string"
            ? secretRecord.backup_codes_used
            : JSON.stringify(secretRecord.backup_codes_used || "[]")
        )

    const backupResult = await verifyBackupCode(code, encryptedCodes, usedHashes, orgId)

    if (backupResult.valid && backupResult.matchedHash) {
      // Mark backup code as used
      await db.query(
        `UPDATE user_2fa_secrets
         SET backup_codes_used = backup_codes_used || $1::jsonb,
             last_used_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([backupResult.matchedHash]), secretRecord.id]
      )

      // Audit success
      await db.query(
        `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, ip_address, metadata)
         VALUES ($1, $2, 'recovery_used', 'totp', true, $3, $4)`,
        [
          userId,
          orgId,
          ipAddress || null,
          JSON.stringify({ backup_code_hash: backupResult.matchedHash }),
        ]
      )

      return { success: true, method: "backup_code" }
    }
  }

  // Both failed
  await db.query(
    `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, failure_reason, ip_address)
     VALUES ($1, $2, 'verification_failed', 'totp', false, 'Invalid code or backup code', $3)`,
    [userId, orgId, ipAddress || null]
  )

  return { success: false, error: "Invalid verification code" }
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT EXISTS(
        SELECT 1 FROM user_2fa_secrets
        WHERE user_id = $1 AND enabled = true
      ) as has_2fa`,
      [userId]
    )

    return result.rows[0]?.has_2fa || false
  } catch (error) {
    // If table doesn't exist yet (migration not run), return false
    // This allows signin to work before 2FA is fully set up
    console.warn("[2FA] Error checking 2FA status (tables may not exist yet):", error)
    return false
  }
}

/**
 * Disable 2FA for a user (requires verification first)
 */
export async function disable2FA(
  userId: string,
  orgId: string,
  verificationCode: string,
  ipAddress?: string | null
): Promise<{ success: boolean; error?: string }> {
  // Verify code first
  const verification = await verify2FACode(userId, orgId, verificationCode, ipAddress)

  if (!verification.success) {
    return { success: false, error: "Invalid verification code" }
  }

  // Disable 2FA
  await db.query(
    `UPDATE user_2fa_secrets
     SET enabled = false, updated_at = NOW()
     WHERE user_id = $1 AND method = 'totp'`,
    [userId]
  )

  // Audit
  await db.query(
    `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, ip_address)
     VALUES ($1, $2, 'disabled', 'totp', true, $3)`,
    [userId, orgId, ipAddress || null]
  )

  return { success: true }
}

/**
 * Regenerate backup codes (requires verification)
 */
export async function regenerateBackupCodes(
  userId: string,
  orgId: string,
  verificationCode: string,
  ipAddress?: string | null
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  // Verify code first
  const verification = await verify2FACode(userId, orgId, verificationCode, ipAddress)

  if (!verification.success) {
    return { success: false, error: "Invalid verification code" }
  }

  // Generate new backup codes
  const backupCodes = generateBackupCodes()
  const encryptedBackupCodes = await Promise.all(
    backupCodes.map((code) => encryptForOrg(code, orgId))
  )

  // Update database
  await db.query(
    `UPDATE user_2fa_secrets
     SET backup_codes_encrypted = $1,
         backup_codes_used = '[]'::jsonb,
         updated_at = NOW()
     WHERE user_id = $2 AND method = 'totp'`,
    [JSON.stringify(encryptedBackupCodes), userId]
  )

  // Audit
  await db.query(
    `INSERT INTO twofa_audit_log (user_id, org_id, event_type, method, success, ip_address)
     VALUES ($1, $2, 'recovery_regenerated', 'totp', true, $3)`,
    [userId, orgId, ipAddress || null]
  )

  return { success: true, backupCodes }
}

/**
 * Get user's 2FA status and metadata
 */
export async function get2FAStatus(userId: string): Promise<{
  enabled: boolean
  method?: string
  verified?: boolean
  backupCodesRemaining?: number
  lastUsedAt?: string | null
}> {
  const result = await db.query<TwoFactorSecret>(
    `SELECT * FROM user_2fa_secrets
     WHERE user_id = $1 AND method = 'totp'
     LIMIT 1`,
    [userId]
  )

  if (result.rows.length === 0) {
    return { enabled: false }
  }

  const secret = result.rows[0]
  const usedCodes = Array.isArray(secret.backup_codes_used)
    ? secret.backup_codes_used
    : JSON.parse(
        typeof secret.backup_codes_used === "string"
          ? secret.backup_codes_used
          : JSON.stringify(secret.backup_codes_used || "[]")
      )

  let totalCodes = 0
  if (secret.backup_codes_encrypted) {
    const codes = JSON.parse(
      typeof secret.backup_codes_encrypted === "string"
        ? secret.backup_codes_encrypted
        : JSON.stringify(secret.backup_codes_encrypted)
    )
    totalCodes = codes.length
  }

  return {
    enabled: secret.enabled,
    method: secret.method,
    verified: secret.verified,
    backupCodesRemaining: totalCodes - usedCodes.length,
    lastUsedAt: secret.last_used_at,
  }
}

import "server-only"
import { isEncryptionEnabled } from "@/lib/encryption"
import { db } from "@/lib/database/pg-client"

/**
 * Check if file encryption is enabled for a specific organization.
 * Requires both the global master key AND the per-org setting.
 */
export async function isOrgFileEncryptionEnabled(orgId: string): Promise<boolean> {
  if (!isEncryptionEnabled()) return false

  try {
    const result = await db.query(
      `SELECT settings->'encryption'->>'file_encryption_enabled' as enabled
       FROM organizations WHERE id = $1`,
      [orgId]
    )
    return result.rows[0]?.enabled === "true"
  } catch {
    return false
  }
}

export interface EncryptionStatusInfo {
  masterKeyConfigured: boolean
  orgEncryptionEnabled: boolean
  enabledAt: string | null
  enabledBy: string | null
}

/**
 * Get full encryption status for an organization (used by the status API route).
 */
export async function getEncryptionStatus(orgId: string): Promise<EncryptionStatusInfo> {
  const masterKeyConfigured = isEncryptionEnabled()

  try {
    const result = await db.query(
      `SELECT settings->'encryption' as enc FROM organizations WHERE id = $1`,
      [orgId]
    )
    const enc = result.rows[0]?.enc || {}
    return {
      masterKeyConfigured,
      orgEncryptionEnabled: enc.file_encryption_enabled === true,
      enabledAt: enc.enabled_at || null,
      enabledBy: enc.enabled_by || null,
    }
  } catch {
    return {
      masterKeyConfigured,
      orgEncryptionEnabled: false,
      enabledAt: null,
      enabledBy: null,
    }
  }
}

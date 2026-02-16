import "server-only"
import { db } from "@/lib/database/pg-client"

/**
 * Centralized audit event types.
 * Uses "category.action" naming convention.
 */
export type AuditAction =
  // Authentication
  | "user.login"
  | "user.login_failed"
  | "user.logout"
  | "user.password_changed"
  | "user.2fa_enabled"
  | "user.2fa_disabled"
  // SSO
  | "sso.login"
  | "sso.login_failed"
  | "sso.provider_created"
  | "sso.provider_updated"
  | "sso.provider_deleted"
  | "sso.activated"
  | "sso.deactivated"
  // Organization
  | "org.settings_updated"
  | "org.sso_enabled"
  | "org.sso_disabled"
  | "org.member_added"
  | "org.member_removed"
  | "org.member_role_changed"
  | "org.invite_sent"
  | "org.invite_accepted"
  // Admin
  | "admin.lockout_cleared"
  | "admin.user_searched"

export interface AuditEventParams {
  userId?: string | null
  action: AuditAction
  resourceType: string
  resourceId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Log an audit event to the `audit_trail` table.
 *
 * Fire-and-forget: catches errors silently so it never
 * disrupts the main business operation.
 *
 * Uses the existing `audit_trail` table from script 27.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    // The audit_trail.resource_id column is UUID. If the value is not
    // a valid UUID we store it in metadata instead to avoid cast errors.
    let resourceId: string | null = null
    let extraMetadata: Record<string, unknown> = {}

    if (params.resourceId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(params.resourceId)) {
        resourceId = params.resourceId
      } else {
        extraMetadata.resourceIdString = params.resourceId
      }
    }

    const metadata = { ...extraMetadata, ...(params.metadata || {}) }

    // ip_address is INET — pass null if empty/invalid to avoid cast errors
    const ipAddress = params.ipAddress && params.ipAddress !== "unknown" ? params.ipAddress : null

    await db.query(
      `INSERT INTO audit_trail
         (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9)`,
      [
        params.userId || null,
        params.action,
        params.resourceType,
        resourceId,
        params.oldValues ? JSON.stringify(params.oldValues) : null,
        params.newValues ? JSON.stringify(params.newValues) : null,
        ipAddress,
        params.userAgent || null,
        JSON.stringify(metadata),
      ],
    )
  } catch (error) {
    // Never let audit logging break the main operation
    console.error("[Audit] Failed to log event:", params.action, error)
  }
}

// Organization-level 2FA Policy Management
// Handles enforcement, compliance checking, and policy administration

import "server-only"
import { db } from "@/lib/database/pg-client"

export interface TwoFactorPolicy {
  id: string
  org_id: string
  require_2fa: boolean
  enforce_for_admins_only: boolean
  allowed_methods: string[]
  grace_period_days: number
  enforcement_starts_at: string | null
  created_at: string
  updated_at: string
}

export interface ComplianceStatus {
  compliant: boolean
  reason?: string
}

export interface UserCompliance {
  user_id: string
  email: string
  full_name: string
  role: string
  has_2fa: boolean
  compliant: boolean
}

/**
 * Get organization's 2FA policy
 */
export async function getOrgPolicy(orgId: string): Promise<TwoFactorPolicy | null> {
  try {
    const result = await db.query<TwoFactorPolicy>(
      `SELECT * FROM organization_2fa_policies WHERE org_id = $1 LIMIT 1`,
      [orgId]
    )

    return result.rows[0] || null
  } catch (error) {
    console.warn("[2FA Policy] Error fetching org policy:", error)
    return null
  }
}

/**
 * Enable 2FA requirement for organization
 * Enforcement starts immediately - no grace period
 */
export async function enableOrgEnforcement(
  orgId: string,
  options: {
    adminsOnly?: boolean
    gracePeriodDays?: number
  } = {}
): Promise<void> {
  const { adminsOnly = false, gracePeriodDays = 0 } = options

  // Enforce immediately - no grace period
  const enforcementStartsAt = new Date()

  await db.query(
    `INSERT INTO organization_2fa_policies
     (org_id, require_2fa, enforce_for_admins_only, grace_period_days, enforcement_starts_at)
     VALUES ($1, true, $2, $3, $4)
     ON CONFLICT (org_id)
     DO UPDATE SET
       require_2fa = true,
       enforce_for_admins_only = $2,
       grace_period_days = $3,
       enforcement_starts_at = $4,
       updated_at = NOW()`,
    [orgId, adminsOnly, gracePeriodDays, enforcementStartsAt]
  )
}

/**
 * Disable 2FA requirement for organization
 */
export async function disableOrgEnforcement(orgId: string): Promise<void> {
  await db.query(
    `UPDATE organization_2fa_policies
     SET require_2fa = false, updated_at = NOW()
     WHERE org_id = $1`,
    [orgId]
  )
}

/**
 * Check if user complies with org 2FA policy
 * No grace period - enforcement is immediate
 */
export async function checkUserCompliance(
  userId: string,
  orgId: string
): Promise<ComplianceStatus> {
  // Get policy
  const policy = await getOrgPolicy(orgId)

  if (!policy?.require_2fa) {
    return { compliant: true }
  }

  // Check if policy applies to this user
  if (policy.enforce_for_admins_only) {
    // Check if user is admin
    const roleResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'
       LIMIT 1`,
      [userId, orgId]
    )

    if (roleResult.rows.length === 0) {
      return { compliant: true }
    }

    const role = roleResult.rows[0].role
    const isAdmin = ["owner", "admin"].includes(role)

    if (!isAdmin) {
      return { compliant: true } // Policy doesn't apply to non-admins
    }
  }

  // Check if user has 2FA enabled
  const result = await db.query(
    `SELECT EXISTS(
      SELECT 1 FROM user_2fa_secrets
      WHERE user_id = $1 AND enabled = true
    ) as has_2fa`,
    [userId]
  )

  const has2FA = result.rows[0]?.has_2fa || false

  if (!has2FA) {
    return {
      compliant: false,
      reason: "Organization requires two-factor authentication",
    }
  }

  return { compliant: true }
}

/**
 * Get users who need to enable 2FA (non-compliant users)
 */
export async function getUsersNeedingCompliance(orgId: string): Promise<UserCompliance[]> {
  const policy = await getOrgPolicy(orgId)

  if (!policy?.require_2fa) {
    return []
  }

  // Build role filter
  const roleFilter = policy.enforce_for_admins_only
    ? `AND om.role IN ('owner', 'admin')`
    : ""

  // Get users without 2FA
  const result = await db.query<UserCompliance>(
    `SELECT
       u.id as user_id,
       u.email,
       u.full_name,
       om.role,
       CASE WHEN twofa.id IS NOT NULL THEN true ELSE false END as has_2fa,
       CASE WHEN twofa.id IS NOT NULL THEN true ELSE false END as compliant
     FROM users u
     JOIN organization_members om ON om.user_id = u.id
     LEFT JOIN user_2fa_secrets twofa ON twofa.user_id = u.id AND twofa.enabled = true
     WHERE om.org_id = $1
       AND om.status = 'active'
       ${roleFilter}
     ORDER BY
       CASE WHEN twofa.id IS NULL THEN 0 ELSE 1 END,
       u.email`,
    [orgId]
  )

  return result.rows
}

/**
 * Get compliance statistics for organization
 */
export async function getOrgComplianceStats(orgId: string): Promise<{
  totalUsers: number
  usersWithout2FA: number
  usersInGracePeriod: number
  complianceRate: number
} | null> {
  const policy = await getOrgPolicy(orgId)

  // If no policy or not enforcing, return null (not applicable)
  if (!policy?.require_2fa) {
    return null
  }

  const users = await getUsersNeedingCompliance(orgId)

  if (users.length === 0) {
    // Policy is enabled but no users in scope
    return { totalUsers: 0, usersWithout2FA: 0, usersInGracePeriod: 0, complianceRate: 100 }
  }

  const usersWithout2FA = users.filter((u) => !u.has_2fa).length
  const usersInGracePeriod = 0 // Will be calculated based on grace period logic if needed
  const complianceRate = Math.round(((users.length - usersWithout2FA) / users.length) * 100)

  return {
    totalUsers: users.length,
    usersWithout2FA,
    usersInGracePeriod,
    complianceRate,
  }
}

import "server-only"
import { db } from "@/lib/database/pg-client"
import { createToken } from "@/lib/auth/local-auth"
import { is2FAEnabled } from "@/lib/auth/2fa"
import { checkUserCompliance } from "@/lib/auth/2fa-policy"
import { logAuditEvent } from "@/lib/audit/audit-logger"
import type { OIDCUserInfo } from "@/lib/auth/oidc-client"

export interface SSOLoginResult {
  success: boolean
  token?: string
  userId?: string
  email?: string
  error?: string
  requires2FA?: boolean
  requiresSetup?: boolean
}

interface SSOLoginParams {
  orgId: string
  idpId: string
  protocol: "oidc" | "saml"
  userInfo: OIDCUserInfo
  jitEnabled: boolean
  defaultRole: string
  autoUpdateProfile: boolean
  ipAddress?: string
  userAgent?: string
}

/**
 * Process an SSO login after the IdP has validated the user.
 *
 * Handles account linking, JIT provisioning, federated identity
 * records, org membership, 2FA compliance, and JWT creation.
 */
export async function processSSOLogin(params: SSOLoginParams): Promise<SSOLoginResult> {
  const { orgId, idpId, protocol, userInfo, jitEnabled, defaultRole, autoUpdateProfile } = params

  try {
    // Resolve or provision the local user
    const userId = await resolveOrProvisionUser({
      idpId, orgId, protocol, userInfo, jitEnabled, defaultRole, autoUpdateProfile,
    })

    // Update auth_method
    await db.query(
      `UPDATE users SET auth_method = $1, updated_at = NOW() WHERE id = $2`,
      [protocol, userId],
    )

    // Check 2FA compliance and return appropriate result
    const result = await buildLoginResult(userId, orgId, userInfo.email)

    if (result.token) {
      logAuditEvent({
        userId,
        action: "sso.login",
        resourceType: "user",
        resourceId: userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { email: userInfo.email, protocol, orgId, idpId, externalId: userInfo.externalId },
      })
    }

    return result
  } catch (error) {
    console.error("[SSO] Login processing error:", error)

    logAuditEvent({
      action: "sso.login_failed",
      resourceType: "user",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { email: userInfo.email, protocol, orgId, idpId, error: error instanceof Error ? error.message : "Unknown" },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : "SSO login failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ProvisionParams {
  idpId: string
  orgId: string
  protocol: string
  userInfo: OIDCUserInfo
  jitEnabled: boolean
  defaultRole: string
  autoUpdateProfile: boolean
}

/**
 * Find the local user for this SSO identity, or create one via JIT.
 * Returns the local userId.
 */
async function resolveOrProvisionUser(p: ProvisionParams): Promise<string> {
  const existing = await db.query<{ id: string; user_id: string }>(
    `SELECT fi.id, fi.user_id FROM federated_identities fi
     WHERE fi.idp_id = $1 AND fi.external_id = $2`,
    [p.idpId, p.userInfo.externalId],
  )

  if (existing.rows.length > 0) {
    return await handleReturningUser(existing.rows[0], p)
  }

  return await handleNewFederatedUser(p)
}

/** Update last-login and optionally the profile for a returning SSO user. */
async function handleReturningUser(
  federated: { id: string; user_id: string },
  p: ProvisionParams,
): Promise<string> {
  await db.query(
    `UPDATE federated_identities
     SET last_login_at = NOW(), external_email = $1,
         external_display_name = $2, external_attributes = $3, updated_at = NOW()
     WHERE id = $4`,
    [p.userInfo.email, p.userInfo.displayName, JSON.stringify(p.userInfo.rawAttributes), federated.id],
  )

  if (p.autoUpdateProfile) {
    await db.query(
      `UPDATE users SET full_name = COALESCE(NULLIF($1, ''), full_name), updated_at = NOW()
       WHERE id = $2`,
      [p.userInfo.displayName, federated.user_id],
    )
  }

  console.log(`[SSO] Returning user login: ${p.userInfo.email}`)
  return federated.user_id
}

/** Link to an existing local account or JIT-provision a brand new user. */
async function handleNewFederatedUser(p: ProvisionParams): Promise<string> {
  const existingUser = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [p.userInfo.email],
  )

  let userId: string

  if (existingUser.rows.length > 0) {
    userId = existingUser.rows[0].id
    if (p.autoUpdateProfile) {
      await db.query(
        `UPDATE users SET full_name = COALESCE(NULLIF($1, ''), full_name),
             auth_method = $2, updated_at = NOW() WHERE id = $3`,
        [p.userInfo.displayName, p.protocol, userId],
      )
    }
    console.log(`[SSO] Linked existing user: ${p.userInfo.email}`)
  } else {
    if (!p.jitEnabled) {
      throw new Error("User does not exist and JIT provisioning is disabled for this organization.")
    }

    const newUser = await db.query<{ id: string }>(
      `INSERT INTO users (email, full_name, email_verified, auth_method, hub_mode, created_at, updated_at)
       VALUES ($1, $2, true, $3, 'full_access', NOW(), NOW()) RETURNING id`,
      [p.userInfo.email, p.userInfo.displayName, p.protocol],
    )
    userId = newUser.rows[0].id
    console.log(`[SSO] JIT provisioned new user: ${p.userInfo.email}`)
  }

  // Create federated identity record
  await db.query(
    `INSERT INTO federated_identities
       (user_id, idp_id, external_id, external_email, external_display_name, external_attributes, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [userId, p.idpId, p.userInfo.externalId, p.userInfo.email, p.userInfo.displayName, JSON.stringify(p.userInfo.rawAttributes)],
  )

  // Ensure organization membership
  await ensureOrgMembership(p.orgId, userId, p.defaultRole)

  return userId
}

/** Check 2FA and produce the appropriate login result. */
async function buildLoginResult(userId: string, orgId: string, email: string): Promise<SSOLoginResult> {
  const has2FA = await is2FAEnabled(userId)
  const compliance = await checkUserCompliance(userId, orgId)

  if (!compliance.compliant && !has2FA) {
    const token = await createToken(userId)
    return { success: true, token, userId, email, requiresSetup: true }
  }

  if (has2FA) {
    return { success: true, userId, email, requires2FA: true }
  }

  const token = await createToken(userId)
  return { success: true, token, userId, email }
}

/** Ensure the user is an active member of the organization. */
async function ensureOrgMembership(orgId: string, userId: string, role: string): Promise<void> {
  const existing = await db.query(
    `SELECT id, status FROM organization_members WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
    [orgId, userId],
  )

  if (existing.rows.length === 0) {
    await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
      [orgId, userId, role],
    )
    console.log(`[SSO] Added user to organization`)
  } else if (existing.rows[0].status !== "active") {
    // Omit updated_at — the Windows Server schema for organization_members
    // does not have that column, and writing it throws.
    try {
      await db.query(
        `UPDATE organization_members SET status = 'active'
         WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId],
      )
      console.log(`[SSO] Reactivated user organization membership`)
    } catch (err) {
      console.error("[SSO] Failed to reactivate org membership:", err)
    }
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { encryptForOrg, decryptForOrg } from "@/lib/encryption"
import { logAuditEvent } from "@/lib/audit/audit-logger"
import { getRequestContext } from "@/lib/audit/request-context"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * Helper: Verify the user is an Owner of the organization.
 */
async function verifyOwner(userId: string, orgId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT role FROM organization_members
     WHERE user_id = $1 AND org_id = $2 AND status = 'active'
     LIMIT 1`,
    [userId, orgId],
  )
  return result.rows.length > 0 && result.rows[0].role === "owner"
}

/**
 * GET /api/organizations/[orgId]/sso
 * Returns the SSO configuration for the organization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json({ error: "Only organization owners can manage SSO" }, { status: 403 })
    }

    // Get org SSO settings (sso_enforce_only may not exist if migration not yet run)
    let orgResult
    try {
      orgResult = await db.query(
        `SELECT sso_enabled, sso_provider, sso_enforce_only FROM organizations WHERE id = $1`,
        [orgId],
      )
    } catch {
      // sso_enforce_only column may not exist yet — fall back
      orgResult = await db.query(
        `SELECT sso_enabled, sso_provider, false as sso_enforce_only FROM organizations WHERE id = $1`,
        [orgId],
      )
    }

    if (orgResult.rows.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const org = orgResult.rows[0]

    // Get IdP config (table may not exist if migration not yet run)
    let idp = null
    try {
      const idpResult = await db.query(
        `SELECT id, display_name, protocol, status,
                oidc_discovery_url, oidc_client_id, oidc_scopes,
                attribute_mapping, jit_provisioning_enabled, default_role, auto_update_profile,
                created_at, updated_at
         FROM identity_providers
         WHERE org_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [orgId],
      )
      idp = idpResult.rows.length > 0 ? idpResult.rows[0] : null
    } catch {
      // identity_providers table may not exist yet
    }

    // Get verified domains
    const domainsResult = await db.query(
      `SELECT id, domain, is_verified, verified_at
       FROM organization_domains
       WHERE org_id = $1
       ORDER BY is_primary DESC, domain ASC`,
      [orgId],
    )

    return NextResponse.json({
      ssoEnabled: org.sso_enabled,
      ssoProvider: org.sso_provider,
      ssoEnforceOnly: org.sso_enforce_only,
      identityProvider: idp,
      domains: domainsResult.rows,
    })
  } catch (error) {
    console.error("[SSO API] GET error:", error)
    return NextResponse.json({ error: "Failed to load SSO configuration" }, { status: 500 })
  }
}

/**
 * POST /api/organizations/[orgId]/sso
 * Create or update the SSO identity provider configuration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json({ error: "Only organization owners can manage SSO" }, { status: 403 })
    }

    const body = await request.json()
    const {
      displayName,
      protocol = "oidc",
      discoveryUrl,
      clientId,
      clientSecret,
      scopes = "openid profile email",
      attributeMapping,
      jitProvisioningEnabled = true,
      defaultRole = "member",
      autoUpdateProfile = true,
      ssoEnabled = false,
      ssoEnforceOnly = false,
    } = body

    if (!discoveryUrl || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Discovery URL, Client ID, and Client Secret are required" },
        { status: 400 },
      )
    }

    // Encrypt the client secret
    const encryptedSecret = await encryptForOrg(clientSecret, orgId)

    // Upsert the identity provider (one per org per protocol)
    const idpResult = await db.query(
      `INSERT INTO identity_providers
         (org_id, display_name, protocol, status,
          oidc_discovery_url, oidc_client_id, oidc_client_secret_encrypted, oidc_scopes,
          attribute_mapping, jit_provisioning_enabled, default_role, auto_update_profile,
          created_by)
       VALUES ($1, $2, $3, 'draft',
               $4, $5, $6, $7,
               $8, $9, $10, $11,
               $12)
       ON CONFLICT (org_id, protocol) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         oidc_discovery_url = EXCLUDED.oidc_discovery_url,
         oidc_client_id = EXCLUDED.oidc_client_id,
         oidc_client_secret_encrypted = EXCLUDED.oidc_client_secret_encrypted,
         oidc_scopes = EXCLUDED.oidc_scopes,
         attribute_mapping = EXCLUDED.attribute_mapping,
         jit_provisioning_enabled = EXCLUDED.jit_provisioning_enabled,
         default_role = EXCLUDED.default_role,
         auto_update_profile = EXCLUDED.auto_update_profile,
         updated_at = NOW()
       RETURNING id, status`,
      [
        orgId,
        displayName || "SSO Provider",
        protocol,
        discoveryUrl,
        clientId,
        encryptedSecret,
        scopes,
        JSON.stringify(attributeMapping || { email: "email", first_name: "given_name", last_name: "family_name", display_name: "name" }),
        jitProvisioningEnabled,
        defaultRole,
        autoUpdateProfile,
        session.user.id,
      ],
    )

    // Update organization SSO settings
    await db.query(
      `UPDATE organizations
       SET sso_enabled = $1, sso_provider = $2, sso_enforce_only = $3, updated_at = NOW()
       WHERE id = $4`,
      [ssoEnabled, protocol, ssoEnforceOnly, orgId],
    )

    const { ipAddress, userAgent } = getRequestContext(request)
    logAuditEvent({
      userId: session.user.id,
      action: "sso.provider_created",
      resourceType: "identity_provider",
      resourceId: idpResult.rows[0].id,
      ipAddress,
      userAgent,
      metadata: { orgId, protocol, displayName },
    })

    return NextResponse.json({
      success: true,
      identityProvider: idpResult.rows[0],
    })
  } catch (error) {
    console.error("[SSO API] POST error:", error)
    return NextResponse.json({ error: "Failed to save SSO configuration" }, { status: 500 })
  }
}

/**
 * PATCH /api/organizations/[orgId]/sso
 * Activate, deactivate, or update SSO settings.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json({ error: "Only organization owners can manage SSO" }, { status: 403 })
    }

    const body = await request.json()
    const { action, ssoEnabled, ssoEnforceOnly } = body

    if (action === "activate") {
      // Verify there's a configured IdP
      const idpResult = await db.query(
        `SELECT id FROM identity_providers WHERE org_id = $1 LIMIT 1`,
        [orgId],
      )

      if (idpResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Configure an identity provider before activating SSO" },
          { status: 400 },
        )
      }

      // Verify at least one verified domain exists
      const domainResult = await db.query(
        `SELECT id FROM organization_domains WHERE org_id = $1 AND is_verified = true LIMIT 1`,
        [orgId],
      )

      if (domainResult.rows.length === 0) {
        return NextResponse.json(
          { error: "At least one verified domain is required to activate SSO" },
          { status: 400 },
        )
      }

      await db.query(
        `UPDATE identity_providers SET status = 'active', updated_at = NOW() WHERE org_id = $1`,
        [orgId],
      )
      await db.query(
        `UPDATE organizations SET sso_enabled = true, updated_at = NOW() WHERE id = $1`,
        [orgId],
      )

      const { ipAddress: activateIp, userAgent: activateUa } = getRequestContext(request)
      logAuditEvent({
        userId: session.user.id, action: "sso.activated", resourceType: "organization",
        resourceId: orgId, ipAddress: activateIp, userAgent: activateUa,
      })

      return NextResponse.json({ success: true, status: "active" })
    }

    if (action === "deactivate") {
      await db.query(
        `UPDATE identity_providers SET status = 'disabled', updated_at = NOW() WHERE org_id = $1`,
        [orgId],
      )
      await db.query(
        `UPDATE organizations SET sso_enabled = false, sso_enforce_only = false, updated_at = NOW() WHERE id = $1`,
        [orgId],
      )

      const { ipAddress: deactivateIp, userAgent: deactivateUa } = getRequestContext(request)
      logAuditEvent({
        userId: session.user.id, action: "sso.deactivated", resourceType: "organization",
        resourceId: orgId, ipAddress: deactivateIp, userAgent: deactivateUa,
      })

      return NextResponse.json({ success: true, status: "disabled" })
    }

    // General settings update
    if (typeof ssoEnabled === "boolean") {
      await db.query(
        `UPDATE organizations SET sso_enabled = $1, updated_at = NOW() WHERE id = $2`,
        [ssoEnabled, orgId],
      )
    }

    if (typeof ssoEnforceOnly === "boolean") {
      await db.query(
        `UPDATE organizations SET sso_enforce_only = $1, updated_at = NOW() WHERE id = $2`,
        [ssoEnforceOnly, orgId],
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[SSO API] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update SSO settings" }, { status: 500 })
  }
}

/**
 * DELETE /api/organizations/[orgId]/sso
 * Remove SSO configuration entirely.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json({ error: "Only organization owners can manage SSO" }, { status: 403 })
    }

    await db.query(`DELETE FROM identity_providers WHERE org_id = $1`, [orgId])
    await db.query(
      `UPDATE organizations
       SET sso_enabled = false, sso_provider = NULL, sso_connection_id = NULL, sso_enforce_only = false, updated_at = NOW()
       WHERE id = $1`,
      [orgId],
    )

    logAuditEvent({
      userId: session.user.id, action: "sso.provider_deleted", resourceType: "organization",
      resourceId: orgId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[SSO API] DELETE error:", error)
    return NextResponse.json({ error: "Failed to remove SSO configuration" }, { status: 500 })
  }
}

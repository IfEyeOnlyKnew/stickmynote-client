import "server-only"
import { db } from "@/lib/database/pg-client"

export interface AuthMethodResolution {
  method: "ldap" | "oidc"
  orgId?: string
  idpId?: string
  enforceOnly?: boolean
}

/**
 * Resolve the authentication method for a given email address.
 *
 * Checks the email domain against verified organization domains,
 * then checks if the org has an active SSO identity provider.
 * Defaults to LDAP if no SSO is configured.
 */
export async function resolveAuthMethod(email: string): Promise<AuthMethodResolution> {
  const defaultResult: AuthMethodResolution = { method: "ldap" }

  if (!email?.includes("@")) {
    return defaultResult
  }

  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) {
    return defaultResult
  }

  try {
    // Find a verified domain that maps to an organization with SSO enabled
    const result = await db.query<{
      org_id: string
      sso_enabled: boolean
      sso_enforce_only: boolean
      idp_id: string | null
      protocol: string | null
      idp_status: string | null
    }>(
      `SELECT
         od.org_id,
         o.sso_enabled,
         COALESCE(o.sso_enforce_only, false) AS sso_enforce_only,
         ip.id AS idp_id,
         ip.protocol,
         ip.status AS idp_status
       FROM organization_domains od
       JOIN organizations o ON o.id = od.org_id
       LEFT JOIN identity_providers ip ON ip.org_id = o.id AND ip.status = 'active'
       WHERE od.domain = $1 AND od.is_verified = true
       LIMIT 1`,
      [domain],
    )

    if (result.rows.length === 0) {
      return defaultResult
    }

    const row = result.rows[0]

    // SSO must be enabled on the org AND have an active IdP
    if (!row.sso_enabled || !row.idp_id) {
      return defaultResult
    }

    return {
      method: row.protocol as "oidc",
      orgId: row.org_id,
      idpId: row.idp_id,
      enforceOnly: row.sso_enforce_only,
    }
  } catch (error) {
    console.error("[SSO Resolver] Error resolving auth method:", error)
    return defaultResult
  }
}

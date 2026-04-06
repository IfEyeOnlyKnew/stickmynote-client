import "server-only"
import { db } from "@/lib/database/pg-client"
import { decryptForOrg } from "@/lib/encryption"

export interface IdPConfig {
  id: string
  org_id: string
  protocol: string
  oidc_discovery_url: string
  oidc_client_id: string
  oidc_client_secret_encrypted: string
  oidc_scopes: string
  attribute_mapping: Record<string, string>
  jit_provisioning_enabled: boolean
  default_role: string
  auto_update_profile: boolean
}

export interface OIDCUserInfo {
  externalId: string
  email: string
  displayName: string
  firstName?: string
  lastName?: string
  rawAttributes: Record<string, unknown>
}

// Cache discovered configurations for 1 hour (openid-client config type is not directly importable)
const discoveryCache = new Map<string, { config: any; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Load an IdP config from the database and decrypt secrets.
 */
export async function loadIdPConfig(idpId: string, orgId: string): Promise<IdPConfig> {
  const result = await db.query<IdPConfig>(
    `SELECT id, org_id, protocol,
            oidc_discovery_url, oidc_client_id, oidc_client_secret_encrypted,
            oidc_scopes, attribute_mapping,
            jit_provisioning_enabled, default_role, auto_update_profile
     FROM identity_providers
     WHERE id = $1 AND org_id = $2 AND status = 'active'`,
    [idpId, orgId],
  )

  if (result.rows.length === 0) {
    throw new Error("Identity provider not found or not active")
  }

  return result.rows[0]
}

/**
 * Discover an OIDC provider configuration from its discovery URL.
 * Results are cached for 1 hour.
 */
async function discoverProvider(discoveryUrl: string, clientId: string, clientSecret: string) {
  const cacheKey = discoveryUrl
  const cached = discoveryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config
  }

  const oidc = await import("openid-client")

  // The discovery URL should be the issuer URL (e.g., https://login.microsoftonline.com/{tenant}/v2.0)
  const issuerUrl = new URL(discoveryUrl.replace("/.well-known/openid-configuration", ""))
  const config = await oidc.discovery(issuerUrl, clientId, clientSecret)

  discoveryCache.set(cacheKey, { config, expiresAt: Date.now() + CACHE_TTL_MS })
  return config
}

/**
 * Build the OIDC authorization URL with PKCE.
 * Returns the redirect URL plus the code_verifier and state to store in a cookie.
 */
export async function buildAuthorizationUrl(
  idp: IdPConfig,
  redirectUri: string,
  orgId: string,
): Promise<{
  redirectUrl: string
  codeVerifier: string
  state: string
}> {
  const oidc = await import("openid-client")

  const clientSecret = await decryptForOrg(idp.oidc_client_secret_encrypted, orgId)
  const config = await discoverProvider(idp.oidc_discovery_url, idp.oidc_client_id, clientSecret)

  const codeVerifier = oidc.randomPKCECodeVerifier()
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)

  // State carries orgId and idpId so callback knows which IdP to use
  const statePayload = JSON.stringify({
    orgId,
    idpId: idp.id,
    nonce: oidc.randomState(),
  })
  const state = Buffer.from(statePayload).toString("base64url")

  const parameters: Record<string, string> = {
    redirect_uri: redirectUri,
    scope: idp.oidc_scopes || "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  }

  const redirectTo = oidc.buildAuthorizationUrl(config, parameters)

  return {
    redirectUrl: redirectTo.href,
    codeVerifier,
    state,
  }
}

/**
 * Exchange the authorization code for tokens and extract user info.
 */
export async function exchangeCodeForUser(
  idp: IdPConfig,
  orgId: string,
  callbackUrl: string,
  codeVerifier: string,
  expectedState: string,
): Promise<OIDCUserInfo> {
  const oidc = await import("openid-client")

  const clientSecret = await decryptForOrg(idp.oidc_client_secret_encrypted, orgId)
  const config = await discoverProvider(idp.oidc_discovery_url, idp.oidc_client_id, clientSecret)

  const currentUrl = new URL(callbackUrl)
  const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
  })

  // Extract claims from the id_token
  const claims = tokens.claims()
  if (!claims) {
    throw new Error("No claims found in token response")
  }

  const mapping = idp.attribute_mapping || {
    email: "email",
    first_name: "given_name",
    last_name: "family_name",
    display_name: "name",
  }

  const email = (claims[mapping.email] as string) || ""
  const firstName = (claims[mapping.first_name] as string) || ""
  const lastName = (claims[mapping.last_name] as string) || ""
  const displayName = (claims[mapping.display_name] as string) || `${firstName} ${lastName}`.trim()
  const externalId = (claims.sub as string) || ""

  if (!email) {
    throw new Error("Email claim not found in OIDC response. Check attribute mapping.")
  }

  if (!externalId) {
    throw new Error("Subject (sub) claim not found in OIDC response.")
  }

  return {
    externalId,
    email: email.toLowerCase(),
    displayName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    rawAttributes: claims as Record<string, unknown>,
  }
}

/**
 * Test OIDC discovery — validates that the discovery URL is reachable
 * and returns basic server metadata.
 */
export async function testOIDCDiscovery(
  discoveryUrl: string,
  clientId: string,
  clientSecretEncrypted: string,
  orgId: string,
): Promise<{ success: boolean; issuer?: string; error?: string }> {
  try {
    const clientSecret = await decryptForOrg(clientSecretEncrypted, orgId)
    const oidc = await import("openid-client")
    const issuerUrl = new URL(discoveryUrl.replace("/.well-known/openid-configuration", ""))
    const config = await oidc.discovery(issuerUrl, clientId, clientSecret)
    const metadata = config.serverMetadata()

    return {
      success: true,
      issuer: metadata.issuer,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Discovery failed",
    }
  }
}

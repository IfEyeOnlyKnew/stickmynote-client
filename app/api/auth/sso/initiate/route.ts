import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { resolveAuthMethod } from "@/lib/auth/sso-resolver"
import { loadIdPConfig, buildAuthorizationUrl } from "@/lib/auth/oidc-client"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/sso/initiate
 *
 * Starts the SSO flow by resolving the auth method for the given email,
 * building an OIDC authorization URL, and returning the redirect URL.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    const resolution = await resolveAuthMethod(email)

    if (resolution.method === "ldap" || !resolution.orgId || !resolution.idpId) {
      return NextResponse.json(
        { error: "SSO is not configured for this email domain" },
        { status: 400 },
      )
    }

    // Load IdP config
    const idp = await loadIdPConfig(resolution.idpId, resolution.orgId)

    if (idp.protocol !== "oidc") {
      return NextResponse.json(
        { error: "Only OIDC providers are currently supported" },
        { status: 400 },
      )
    }

    // Determine callback URL
    const origin = request.headers.get("origin") || request.nextUrl.origin
    const redirectUri = `${origin}/api/auth/sso/callback`

    // Build authorization URL with PKCE
    const { redirectUrl, codeVerifier, state } = await buildAuthorizationUrl(
      idp,
      redirectUri,
      resolution.orgId,
    )

    // Store code_verifier and state in a short-lived httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set("sso_state", JSON.stringify({ codeVerifier, state }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    })

    return NextResponse.json({ redirectUrl })
  } catch (error) {
    console.error("[SSO Initiate] Error:", error)
    return NextResponse.json(
      { error: "Failed to initiate SSO login" },
      { status: 500 },
    )
  }
}

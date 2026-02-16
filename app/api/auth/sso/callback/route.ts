import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { loadIdPConfig, exchangeCodeForUser } from "@/lib/auth/oidc-client"
import { processSSOLogin } from "@/lib/auth/sso-login"
import { createVerificationSession } from "@/lib/auth/2fa-session"

export const dynamic = "force-dynamic"

/**
 * GET /api/auth/sso/callback
 *
 * OIDC Authorization Code callback. The IdP redirects the user here
 * after authentication with a `code` and `state` in query params.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const errorPage = `${origin}/auth/sso-error`

  try {
    // 1. Read and validate state cookie
    const cookieStore = await cookies()
    const ssoStateCookie = cookieStore.get("sso_state")?.value

    if (!ssoStateCookie) {
      return NextResponse.redirect(`${errorPage}?error=missing_state&message=${encodeURIComponent("SSO session expired. Please try again.")}`)
    }

    let storedState: { codeVerifier: string; state: string }
    try {
      storedState = JSON.parse(ssoStateCookie)
    } catch {
      return NextResponse.redirect(`${errorPage}?error=invalid_state`)
    }

    // Clear the SSO state cookie
    cookieStore.delete("sso_state")

    // 2. Parse state to get orgId and idpId
    const stateParam = request.nextUrl.searchParams.get("state")
    if (!stateParam || stateParam !== storedState.state) {
      return NextResponse.redirect(`${errorPage}?error=state_mismatch&message=${encodeURIComponent("Security validation failed. Please try again.")}`)
    }

    let statePayload: { orgId: string; idpId: string; nonce: string }
    try {
      statePayload = JSON.parse(Buffer.from(stateParam, "base64url").toString())
    } catch {
      return NextResponse.redirect(`${errorPage}?error=invalid_state_payload`)
    }

    // 3. Check for IdP errors
    const errorParam = request.nextUrl.searchParams.get("error")
    if (errorParam) {
      const errorDesc = request.nextUrl.searchParams.get("error_description") || errorParam
      return NextResponse.redirect(`${errorPage}?error=idp_error&message=${encodeURIComponent(errorDesc)}`)
    }

    // 4. Load IdP config
    const idp = await loadIdPConfig(statePayload.idpId, statePayload.orgId)

    // 5. Exchange authorization code for user info
    const callbackUrl = request.url
    const userInfo = await exchangeCodeForUser(
      idp,
      statePayload.orgId,
      callbackUrl,
      storedState.codeVerifier,
      storedState.state,
    )

    // 6. Process SSO login (JIT provision / account link / existing user)
    const result = await processSSOLogin({
      orgId: statePayload.orgId,
      idpId: statePayload.idpId,
      protocol: "oidc",
      userInfo,
      jitEnabled: idp.jit_provisioning_enabled,
      defaultRole: idp.default_role,
      autoUpdateProfile: idp.auto_update_profile,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    if (!result.success) {
      return NextResponse.redirect(`${errorPage}?error=login_failed&message=${encodeURIComponent(result.error || "SSO login failed")}`)
    }

    // 7. Handle 2FA flows
    if (result.requiresSetup && result.token) {
      // Set temporary session and redirect to 2FA setup
      cookieStore.set("session", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours for setup
        path: "/",
      })
      return NextResponse.redirect(`${origin}/auth/setup-2fa`)
    }

    if (result.requires2FA && result.userId) {
      // Create 2FA verification session
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
      const userAgent = request.headers.get("user-agent")
      const { sessionToken, expiresAt } = await createVerificationSession(
        result.userId,
        ipAddress,
        userAgent,
      )

      // Redirect to 2FA verification page with the token
      const verifyUrl = new URL(`${origin}/auth/verify-2fa`)
      verifyUrl.searchParams.set("token", sessionToken)
      verifyUrl.searchParams.set("sso", "true")
      return NextResponse.redirect(verifyUrl.toString())
    }

    // 8. Full success — set session cookie and redirect to post-login callback
    if (result.token) {
      cookieStore.set("session", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      })

      // Set current org cookie so the app knows which org to use
      cookieStore.set("current_org_id", statePayload.orgId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })

      return NextResponse.redirect(`${origin}/auth/callback`)
    }

    return NextResponse.redirect(`${errorPage}?error=no_token&message=${encodeURIComponent("Authentication succeeded but session creation failed.")}`)
  } catch (error) {
    console.error("[SSO Callback] Error:", error)
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return NextResponse.redirect(`${errorPage}?error=unexpected&message=${encodeURIComponent(message)}`)
  }
}

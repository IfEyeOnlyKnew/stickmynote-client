import { type NextRequest, NextResponse } from "next/server"
import { authenticateWithAD } from "@/lib/auth/ldap-auth"
import { createToken } from "@/lib/auth/local-auth"
import { checkLockout, recordLoginAttempt } from "@/lib/auth/lockout"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { is2FAEnabled } from "@/lib/auth/2fa"
import { createVerificationSession } from "@/lib/auth/2fa-session"
import { checkUserCompliance } from "@/lib/auth/2fa-policy"
import { resolveAuthMethod } from "@/lib/auth/sso-resolver"
import { logAuditEvent } from "@/lib/audit/audit-logger"
import { getRequestContext } from "@/lib/audit/request-context"
import { db } from "@/lib/database/pg-client"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if this email domain requires SSO-only login
    const authResolution = await resolveAuthMethod(normalizedEmail)
    if (authResolution.method !== "ldap" && authResolution.enforceOnly) {
      return NextResponse.json(
        { error: "Your organization requires Single Sign-On. Please use the SSO button to sign in." },
        { status: 403 },
      )
    }

    // Check lockout before attempting sign in (direct DB call)
    const lockoutData = await checkLockout(normalizedEmail)
    if (lockoutData.locked) {
      return NextResponse.json(
        {
          error: `Account is temporarily locked. Please try again in ${lockoutData.remainingMinutes} minute${lockoutData.remainingMinutes === 1 ? "" : "s"}.`,
          locked: true,
          remainingMinutes: lockoutData.remainingMinutes,
        },
        { status: 429 }
      )
    }

    // Attempt sign in with Active Directory
    const result = await authenticateWithAD(email, password)

    const { ipAddress, userAgent } = getRequestContext(request)

    if (!result.success || !result.user) {
      // Record failed attempt (direct DB call)
      await recordLoginAttempt(normalizedEmail, false, ipAddress)

      logAuditEvent({
        action: "user.login_failed",
        resourceType: "user",
        ipAddress,
        userAgent,
        metadata: { email: normalizedEmail, reason: result.error || "Invalid credentials" },
      })

      return NextResponse.json(
        { error: result.error || "Invalid credentials" },
        { status: 401 }
      )
    }

    // Get user's organization
    const orgResult = await db.query(
      `SELECT org_id FROM organization_members
       WHERE user_id = $1 AND status = 'active'
       LIMIT 1`,
      [result.user.id]
    )

    let orgId: string | null = null
    if (orgResult.rows.length > 0) {
      orgId = orgResult.rows[0].org_id
    }

    // Check if user has 2FA enabled
    const has2FA = await is2FAEnabled(result.user.id)

    // Check org compliance if user is in an organization
    if (orgId) {
      const compliance = await checkUserCompliance(result.user.id, orgId)

      // If org requires 2FA and user doesn't have it set up, force immediate setup
      if (!compliance.compliant && !has2FA) {

        // Create a temporary token for the setup flow (24 hour expiry)
        const token = await createToken(result.user.id)
        const cookieStore = cookies()
        cookieStore.set("session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24, // 24 hours to complete setup
          path: "/",
        })

        return NextResponse.json({
          requiresSetup: true,
          user: {
            id: result.user.id,
            email: result.user.email,
          },
        })
      }
    }

    // If user has 2FA enabled, require verification
    if (has2FA) {
      // Create temporary verification session
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
      const userAgent = request.headers.get("user-agent")
      const { sessionToken, expiresAt } = await createVerificationSession(
        result.user.id,
        ipAddress,
        userAgent
      )

      // Return 2FA required response (don't create full session yet)
      return NextResponse.json({
        requires2FA: true,
        verificationToken: sessionToken,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: result.user.id,
          email: result.user.email,
        },
      })
    }

    // Create JWT token for the authenticated user
    const token = await createToken(result.user.id)

    // Record successful attempt (direct DB call)
    await recordLoginAttempt(normalizedEmail, true)

    logAuditEvent({
      userId: result.user.id,
      action: "user.login",
      resourceType: "user",
      resourceId: result.user.id,
      ipAddress,
      userAgent,
      metadata: { email: normalizedEmail, method: "ldap" },
    })

    // Set auth cookie
    const cookieStore = cookies()
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    const response = NextResponse.json({
      success: true,
      user: result.user,
      session: { user: result.user }
    })

    return response
  } catch (error) {
    console.error("Sign in error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

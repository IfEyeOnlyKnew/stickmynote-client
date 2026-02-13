// API Route: Verify 2FA During Sign-In
// POST /api/auth/2fa/verify

import { type NextRequest, NextResponse } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { verify2FACode } from "@/lib/auth/2fa"
import { createToken } from "@/lib/auth/local-auth"
import { recordLoginAttempt } from "@/lib/auth/lockout"
import {
  getVerificationSession,
  incrementVerificationAttempt,
  completeVerificationSession,
} from "@/lib/auth/2fa-session"
import { cookies } from "next/headers"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const { verificationToken, code } = await request.json()

    if (!verificationToken || !code) {
      return NextResponse.json(
        { error: "Missing verification token or code" },
        { status: 400 }
      )
    }

    // Get verification session
    const session = await getVerificationSession(verificationToken)
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired verification session" },
        { status: 401 }
      )
    }

    // Check attempt limit
    if (session.verification_attempts >= session.max_attempts) {
      return NextResponse.json(
        { error: "Maximum verification attempts exceeded" },
        { status: 429 }
      )
    }

    // Get user and org
    const userResult = await db.query(
      `SELECT u.id, u.email, u.full_name, u.distinguished_name, om.org_id
       FROM users u
       JOIN organization_members om ON om.user_id = u.id AND om.status = 'active'
       WHERE u.id = $1
       LIMIT 1`,
      [session.user_id]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = userResult.rows[0]
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")

    // Verify 2FA code
    const result = await verify2FACode(user.id, user.org_id, code, ipAddress)

    // Increment attempt counter
    await incrementVerificationAttempt(verificationToken)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Invalid verification code",
          attemptsRemaining: session.max_attempts - session.verification_attempts - 1,
        },
        { status: 400 }
      )
    }

    // Mark session as complete
    await completeVerificationSession(verificationToken)

    // Record successful login
    await recordLoginAttempt(user.email, true)

    // Create JWT token
    const token = await createToken(user.id)

    // Set auth cookie
    const cookieStore = await cookies()
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        distinguished_name: user.distinguished_name,
      },
    })
  } catch (error) {
    console.error("[2FA Verify] Error:", error)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}

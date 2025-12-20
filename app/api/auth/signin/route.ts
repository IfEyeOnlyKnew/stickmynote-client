import { type NextRequest, NextResponse } from "next/server"
import { authenticateWithAD } from "@/lib/auth/ldap-auth"
import { createToken } from "@/lib/auth/local-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
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

    // Check lockout before attempting sign in
    const lockoutCheck = await fetch(`${request.nextUrl.origin}/api/auth/check-lockout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    })

    if (lockoutCheck.ok) {
      const lockoutData = await lockoutCheck.json()
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
    }

    // Attempt sign in with Active Directory
    const result = await authenticateWithAD(email, password)

    if (!result.success || !result.user) {
      // Record failed attempt
      await fetch(`${request.nextUrl.origin}/api/auth/record-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: normalizedEmail, 
          success: false,
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
        }),
      })

      return NextResponse.json(
        { error: result.error || "Invalid credentials" },
        { status: 401 }
      )
    }

    // Create JWT token for the authenticated user
    const token = await createToken(result.user.id)

    // Record successful attempt
    await fetch(`${request.nextUrl.origin}/api/auth/record-attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, success: true }),
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

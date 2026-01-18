import { type NextRequest, NextResponse } from "next/server"
import { signUp, createToken } from "@/lib/auth/local-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { cookies } from "next/headers"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

interface ProfileFields {
  username?: string
  phone?: string
  location?: string
  bio?: string
  website?: string
  avatarUrl?: string
}

async function updateUserProfile(userId: string, fields: ProfileFields): Promise<void> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (fields.username?.trim()) {
    updates.push(`username = $${paramIndex++}`)
    values.push(fields.username.trim())
  }
  if (fields.phone?.trim()) {
    updates.push(`phone = $${paramIndex++}`)
    values.push(fields.phone.trim())
  }
  if (fields.location?.trim()) {
    updates.push(`location = $${paramIndex++}`)
    values.push(fields.location.trim())
  }
  if (fields.bio?.trim()) {
    updates.push(`bio = $${paramIndex++}`)
    values.push(fields.bio.trim())
  }
  if (fields.website?.trim()) {
    updates.push(`website = $${paramIndex++}`)
    values.push(fields.website.trim())
  }
  if (fields.avatarUrl?.trim()) {
    updates.push(`avatar_url = $${paramIndex++}`)
    values.push(fields.avatarUrl.trim())
  }

  if (updates.length > 0) {
    values.push(userId)
    await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }

    const { email, password, fullName, username, phone, location, bio, website, avatarUrl } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await db.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    // Create user with local auth
    const result = await signUp(email, password, fullName)

    if (result.error || !result.user) {
      return NextResponse.json(
        { error: result.error || "Failed to create account" },
        { status: 500 }
      )
    }

    // Update additional user profile fields if provided
    if (username || phone || location || bio || website || avatarUrl) {
      try {
        await updateUserProfile(result.user.id, { username, phone, location, bio, website, avatarUrl })
      } catch (profileError) {
        console.error("Error updating profile:", profileError)
        // Continue - profile updates are non-critical
      }
    }

    // Create token for immediate sign-in
    const token = await createToken(result.user.id)

    // Set auth cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      session: { user: result.user }
    })

    const cookieStore = await cookies()
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Sign up error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

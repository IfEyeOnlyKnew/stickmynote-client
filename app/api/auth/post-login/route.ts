import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/post-login
 * Called after successful authentication to:
 * 1. Update login count and last_login_at
 * 2. Auto-detect and save timezone (if not already set)
 * 3. Determine the appropriate redirect based on user role
 *
 * Body:
 * - timezone?: string (IANA timezone identifier from browser)
 *
 * Returns:
 * - redirect: The path to redirect to
 * - isFirstLogin: Whether this is the user's first login
 * - isOwner: Whether the user is an organization owner
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const userId = session.user.id

    // Parse request body for timezone
    let detectedTimezone: string | null = null
    try {
      const body = await request.json()
      detectedTimezone = body.timezone || null
    } catch {
      // No body or invalid JSON - that's fine, timezone is optional
    }

    // Get current user data including login_count and timezone
    const userResult = await db.query(
      `SELECT id, email, login_count, hub_mode, timezone FROM users WHERE id = $1`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = userResult.rows[0]
    const currentLoginCount = user.login_count || 0
    const isFirstLogin = currentLoginCount === 0

    // Build the update query - include timezone only if user doesn't have one and we detected one
    const shouldUpdateTimezone = !user.timezone && detectedTimezone

    if (shouldUpdateTimezone) {
      await db.query(
        `UPDATE users
         SET login_count = login_count + 1,
             last_login_at = NOW(),
             hub_mode = 'full_access',
             timezone = $2
         WHERE id = $1`,
        [userId, detectedTimezone]
      )
    } else {
      await db.query(
        `UPDATE users
         SET login_count = login_count + 1,
             last_login_at = NOW(),
             hub_mode = 'full_access'
         WHERE id = $1`,
        [userId]
      )
    }

    // Check if user is an organization owner
    const membershipResult = await db.query(
      `SELECT role FROM organization_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
      [userId]
    )

    const isOwner = membershipResult.rows.length > 0

    // Determine redirect path
    let redirect = "/dashboard"

    // If this is the owner's first login, redirect to organization settings
    if (isFirstLogin && isOwner) {
      redirect = "/settings/organization"
    }

    return NextResponse.json({
      success: true,
      redirect,
      isFirstLogin,
      isOwner,
    })
  } catch (error) {
    console.error("[API] Error in post-login:", error)
    return NextResponse.json(
      { error: "Failed to process post-login" },
      { status: 500 }
    )
  }
}

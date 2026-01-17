import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import { syncAllADUsers } from "@/lib/auth/ldap-auth"

/**
 * AD SYNC API
 *
 * Sync all users from Active Directory to the database.
 * This is an admin-only operation.
 */

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT role FROM organization_members 
     WHERE user_id = $1 AND role IN ('owner', 'admin')
     LIMIT 1`,
    [userId]
  )
  return result.rows.length > 0
}

/**
 * POST /api/admin/ad-sync
 * Trigger a full AD user sync
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    // Check admin permissions
    const admin = await isAdmin(user.id)
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    console.log(`[AD Sync] Starting sync initiated by ${user.email}`)

    const result = await syncAllADUsers()

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
        : "Sync completed with errors",
      ...result,
    })
  } catch (error) {
    console.error("[AD Sync] API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/ad-sync
 * Get last sync status (optional - for future use)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const admin = await isAdmin(user.id)
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Get user counts
    const totalUsers = await db.query(`SELECT COUNT(*) as count FROM users`)
    const adUsers = await db.query(`SELECT COUNT(*) as count FROM users WHERE distinguished_name IS NOT NULL`)

    return NextResponse.json({
      totalUsers: parseInt(totalUsers.rows[0].count, 10),
      adUsers: parseInt(adUsers.rows[0].count, 10),
    })
  } catch (error) {
    console.error("[AD Sync] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

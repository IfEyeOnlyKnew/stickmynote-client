import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"

/**
 * USER PRESENCE API
 *
 * Heartbeat endpoint to track online/offline status.
 * Clients should call this every 30-60 seconds while active.
 */

// Online threshold in minutes - users seen within this time are considered online
export const ONLINE_THRESHOLD_MINUTES = 5

/**
 * POST /api/user/presence
 * Update the current user's last_seen_at timestamp (heartbeat)
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

    // Update last_seen_at
    await db.query(
      `UPDATE users SET last_seen_at = NOW() WHERE id = $1`,
      [user.id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Presence] Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/user/presence
 * Get online status for a list of user IDs
 * Query params:
 *   - ids: comma-separated list of user IDs
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

    const searchParams = request.nextUrl.searchParams
    const idsParam = searchParams.get("ids")

    if (!idsParam) {
      return NextResponse.json({ error: "ids parameter required" }, { status: 400 })
    }

    const userIds = idsParam.split(",").map((id) => id.trim()).filter(Boolean)

    if (userIds.length === 0) {
      return NextResponse.json({ presence: {} })
    }

    if (userIds.length > 100) {
      return NextResponse.json({ error: "Maximum 100 user IDs allowed" }, { status: 400 })
    }

    // Get presence for the requested users
    const result = await db.query(
      `SELECT id, last_seen_at,
              CASE WHEN last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_MINUTES} minutes' THEN true ELSE false END as is_online
       FROM users
       WHERE id = ANY($1)`,
      [userIds]
    )

    const presence: Record<string, { isOnline: boolean; lastSeenAt: string | null }> = {}
    for (const row of result.rows) {
      presence[row.id] = {
        isOnline: row.is_online,
        lastSeenAt: row.last_seen_at,
      }
    }

    return NextResponse.json({ presence })
  } catch (error) {
    console.error("[Presence] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

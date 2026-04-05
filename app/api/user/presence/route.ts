import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import { cache } from "@/lib/cache/memcached-client"
import { publishToOrg } from "@/lib/ws/publish-event"
import { getOrgContext } from "@/lib/auth/get-org-context"

/**
 * USER PRESENCE API
 *
 * Heartbeat endpoint to track online/offline status.
 * Clients should call this every 30-60 seconds while active.
 *
 * Presence state is stored in Memcached for fast reads with auto-expiry.
 * PostgreSQL `last_seen_at` is synced every 5 minutes for persistence.
 */

// Memcached TTL for presence key (seconds). If no heartbeat arrives
// within this window, the key auto-expires and the user appears offline.
const PRESENCE_TTL = 60

// How often to sync presence to PostgreSQL (seconds).
// Reduces DB writes from every 30s to every 5 minutes per user (~10x reduction).
const DB_SYNC_INTERVAL = 300

/**
 * POST /api/user/presence
 * Update the current user's presence (heartbeat).
 * Writes to Memcached (fast, auto-expiring) and periodically syncs to PostgreSQL.
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

    const now = new Date().toISOString()

    // Write presence to Memcached with auto-expiry TTL
    await cache.set(
      `presence:${user.id}`,
      JSON.stringify({ lastSeenAt: now }),
      { ex: PRESENCE_TTL }
    )

    // Periodic PostgreSQL sync: only update DB every DB_SYNC_INTERVAL
    const lastDbSync = await cache.get(`presence_db_sync:${user.id}`)
    if (!lastDbSync) {
      await db.query(
        `UPDATE users SET last_seen_at = NOW() WHERE id = $1`,
        [user.id]
      )
      await cache.set(`presence_db_sync:${user.id}`, "1", { ex: DB_SYNC_INTERVAL })
    }

    // Broadcast presence update to org members
    try {
      const orgContext = await getOrgContext()
      if (orgContext) {
        publishToOrg(orgContext.orgId, {
          type: "presence.update",
          payload: { userId: user.id, isOnline: true, lastSeenAt: now },
          timestamp: Date.now(),
        })
      }
    } catch {
      // Non-critical, don't fail the heartbeat
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Presence] Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/user/presence
 * Get online status for a list of user IDs.
 * Reads from Memcached (fast): key exists = online, missing = offline.
 * Falls back to PostgreSQL for last_seen_at of offline users.
 *
 * Query params:
 *   - ids: comma-separated list of user IDs (max 100)
 */
function parseCachedPresence(cached: string | null): { isOnline: boolean; lastSeenAt: string | null } {
  if (!cached) return { isOnline: false, lastSeenAt: null }
  try {
    const data = JSON.parse(cached)
    return { isOnline: true, lastSeenAt: data.lastSeenAt }
  } catch {
    return { isOnline: true, lastSeenAt: null }
  }
}

async function resolvePresence(userIds: string[]): Promise<Record<string, { isOnline: boolean; lastSeenAt: string | null }>> {
  const presence: Record<string, { isOnline: boolean; lastSeenAt: string | null }> = {}
  const offlineIds: string[] = []

  for (const userId of userIds) {
    const cached = await cache.get(`presence:${userId}`)
    presence[userId] = parseCachedPresence(cached)
    if (!cached) offlineIds.push(userId)
  }

  if (offlineIds.length > 0) {
    const result = await db.query(`SELECT id, last_seen_at FROM users WHERE id = ANY($1)`, [offlineIds])
    for (const row of result.rows) {
      if (presence[row.id]) presence[row.id].lastSeenAt = row.last_seen_at
    }
  }

  return presence
}

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

    const presence = await resolvePresence(userIds)
    return NextResponse.json({ presence })
  } catch (error) {
    console.error("[Presence] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

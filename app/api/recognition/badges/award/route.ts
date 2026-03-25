import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { awardBadge } from "@/lib/recognition/badges"
import { publishToUser } from "@/lib/ws/publish-event"
import { db as pgClient } from "@/lib/database/pg-client"

// POST /api/recognition/badges/award - Award a badge to a user (admin only)
export async function POST(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    if (orgContext.role !== "owner" && orgContext.role !== "admin") {
      return NextResponse.json({ error: "Only admins can award badges" }, { status: 403 })
    }

    const body = await request.json()
    const { badgeId, userId, reason } = body

    if (!badgeId || !userId) {
      return NextResponse.json({ error: "Badge ID and user ID are required" }, { status: 400 })
    }

    const result = await awardBadge({
      badgeId,
      userId,
      orgId: orgContext.orgId,
      awardedBy: authResult.user.id,
      reason,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Get badge info for notification
    const badgeInfo = await pgClient.query(
      `SELECT name, description FROM badges WHERE id = $1`,
      [badgeId]
    )
    const badge = badgeInfo.rows?.[0]

    if (badge) {
      // Send notification
      await pgClient.query(
        `INSERT INTO notifications (user_id, org_id, type, title, message, metadata)
         VALUES ($1, $2, 'badge_awarded', $3, $4, $5)`,
        [
          userId,
          orgContext.orgId,
          `You earned the "${badge.name}" badge!`,
          reason || badge.description || "Congratulations!",
          JSON.stringify({ badge_id: badgeId, awarded_by: authResult.user.id }),
        ]
      )

      publishToUser(userId, {
        type: "notification.new",
        payload: {
          type: "badge_awarded",
          title: `You earned the "${badge.name}" badge!`,
          message: reason || badge.description || "Congratulations!",
          badge_id: badgeId,
        },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error awarding badge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

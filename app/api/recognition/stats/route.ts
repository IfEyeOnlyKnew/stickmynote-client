import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"
import { getRecognitionSettings } from "@/lib/recognition/kudos"

// GET /api/recognition/stats - Get recognition stats for current user
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const userId = authResult.user.id
    const orgId = orgContext.orgId

    // Get kudos received count
    const receivedResult = await pgClient.query(
      `SELECT COUNT(DISTINCT k.id) AS cnt, COALESCE(SUM(k.points), 0) AS points
       FROM kudos_recipients kr JOIN kudos k ON k.id = kr.kudos_id
       WHERE kr.user_id = $1 AND k.org_id = $2`,
      [userId, orgId]
    )

    // Get kudos given count
    const givenResult = await pgClient.query(
      `SELECT COUNT(*) AS cnt FROM kudos WHERE giver_id = $1 AND org_id = $2`,
      [userId, orgId]
    )

    // Get badge count
    const badgeResult = await pgClient.query(
      `SELECT COUNT(*) AS cnt FROM badge_awards WHERE user_id = $1 AND org_id = $2`,
      [userId, orgId]
    )

    // Get streaks
    const streakResult = await pgClient.query(
      `SELECT streak_type, current_streak, longest_streak FROM recognition_streaks
       WHERE user_id = $1 AND org_id = $2`,
      [userId, orgId]
    )

    const streaks: Record<string, { current: number; longest: number }> = {}
    for (const row of streakResult.rows || []) {
      streaks[row.streak_type] = {
        current: row.current_streak,
        longest: row.longest_streak,
      }
    }

    // Get today's kudos given (for daily limit display)
    const todayResult = await pgClient.query(
      `SELECT COUNT(*) AS cnt FROM kudos
       WHERE giver_id = $1 AND org_id = $2
       AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [userId, orgId]
    )

    const settings = await getRecognitionSettings(orgId)

    return NextResponse.json({
      kudos_received: parseInt(receivedResult.rows[0]?.cnt || "0", 10),
      total_points: parseInt(receivedResult.rows[0]?.points || "0", 10),
      kudos_given: parseInt(givenResult.rows[0]?.cnt || "0", 10),
      badges_earned: parseInt(badgeResult.rows[0]?.cnt || "0", 10),
      streaks,
      today_given: parseInt(todayResult.rows[0]?.cnt || "0", 10),
      daily_limit: settings.max_kudos_per_day,
    })
  } catch (error) {
    console.error("Error fetching recognition stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

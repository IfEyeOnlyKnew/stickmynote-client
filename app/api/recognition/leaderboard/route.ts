import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"
import { getRecognitionSettings } from "@/lib/recognition/kudos"

function getSortExpression(sortColumn: string): string {
  const expressions: Record<string, string> = {
    kudos_given_count: "g.kudos_given_count",
    kudos_received_count: "r.kudos_received_count",
    total_points: "r.total_points",
  }
  return expressions[sortColumn] || "r.total_points"
}

// GET /api/recognition/leaderboard - Get recognition leaderboard
export async function GET(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const settings = await getRecognitionSettings(orgContext.orgId)
    if (!settings.leaderboard_enabled) {
      return NextResponse.json({ error: "Leaderboard is not enabled" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "all" // "week" | "month" | "quarter" | "all"
    const sortBy = searchParams.get("sortBy") || "points" // "points" | "received" | "given"
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "25", 10), 50)

    const dateFilterMap: Record<string, string> = {
      week: "AND k.created_at >= CURRENT_DATE - INTERVAL '7 days'",
      month: "AND k.created_at >= CURRENT_DATE - INTERVAL '30 days'",
      quarter: "AND k.created_at >= CURRENT_DATE - INTERVAL '90 days'",
    }
    const dateFilter = dateFilterMap[period] || ""

    const sortColumnMap: Record<string, string> = {
      given: "kudos_given_count",
      received: "kudos_received_count",
    }
    const sortColumn = sortColumnMap[sortBy] || "total_points"

    const query = `
      WITH received AS (
        SELECT kr.user_id,
               COUNT(DISTINCT k.id) AS kudos_received_count,
               COALESCE(SUM(k.points), 0) AS total_points
        FROM kudos_recipients kr
        JOIN kudos k ON k.id = kr.kudos_id
        WHERE k.org_id = $1 ${dateFilter}
        GROUP BY kr.user_id
      ),
      given AS (
        SELECT k.giver_id AS user_id,
               COUNT(*) AS kudos_given_count
        FROM kudos k
        WHERE k.org_id = $1 ${dateFilter}
        GROUP BY k.giver_id
      ),
      badge_counts AS (
        SELECT ba.user_id, COUNT(*) AS badges_earned_count
        FROM badge_awards ba
        WHERE ba.org_id = $1
        GROUP BY ba.user_id
      )
      SELECT
        COALESCE(r.user_id, g.user_id) AS user_id,
        u.full_name,
        u.avatar_url,
        COALESCE(r.kudos_received_count, 0) AS kudos_received_count,
        COALESCE(g.kudos_given_count, 0) AS kudos_given_count,
        COALESCE(r.total_points, 0) AS total_points,
        COALESCE(bc.badges_earned_count, 0) AS badges_earned_count,
        ROW_NUMBER() OVER (ORDER BY COALESCE(${getSortExpression(sortColumn)}, 0) DESC) AS rank
      FROM received r
      FULL OUTER JOIN given g ON g.user_id = r.user_id
      JOIN users u ON u.id = COALESCE(r.user_id, g.user_id)
      LEFT JOIN badge_counts bc ON bc.user_id = COALESCE(r.user_id, g.user_id)
      ORDER BY COALESCE(${getSortExpression(sortColumn)}, 0) DESC
      LIMIT $2`

    const result = await pgClient.query(query, [orgContext.orgId, limit])

    return NextResponse.json({ leaderboard: result.rows || [] })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

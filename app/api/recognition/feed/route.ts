import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/recognition/feed - Get the public recognition feed
export async function GET(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const valueId = searchParams.get("valueId")

    let query = `
      SELECT k.id AS kudos_id, k.org_id, k.giver_id, k.message, k.points, k.is_public,
             k.value_id, rv.name AS value_name, rv.emoji AS value_emoji, rv.color AS value_color,
             k.created_at,
             gu.full_name AS giver_name, gu.avatar_url AS giver_avatar,
             json_agg(DISTINCT jsonb_build_object('user_id', ru.id, 'full_name', ru.full_name, 'avatar_url', ru.avatar_url)) AS recipients,
             (SELECT COUNT(*) FROM kudos_reactions kre WHERE kre.kudos_id = k.id) AS reaction_count,
             (SELECT COUNT(*) FROM kudos_comments kc WHERE kc.kudos_id = k.id) AS comment_count,
             EXISTS(SELECT 1 FROM kudos_reactions kre WHERE kre.kudos_id = k.id AND kre.user_id = $3) AS user_has_reacted
      FROM kudos k
      JOIN users gu ON gu.id = k.giver_id
      JOIN kudos_recipients kr ON kr.kudos_id = k.id
      JOIN users ru ON ru.id = kr.user_id
      LEFT JOIN recognition_values rv ON rv.id = k.value_id
      WHERE k.org_id = $1 AND k.is_public = true`

    const params: any[] = [orgContext.orgId, limit, authResult.user.id]
    let paramIdx = 4

    if (valueId) {
      query += ` AND k.value_id = $${paramIdx}`
      params.push(valueId)
      paramIdx++
    }

    query += `
      GROUP BY k.id, k.org_id, k.giver_id, k.message, k.points, k.is_public, k.value_id,
               rv.name, rv.emoji, rv.color, k.created_at, gu.full_name, gu.avatar_url
      ORDER BY k.created_at DESC
      LIMIT $2 OFFSET $${paramIdx}`
    params.push(offset)

    const result = await pgClient.query(query, params)

    return NextResponse.json({ feed: result.rows || [] })
  } catch (error) {
    console.error("Error fetching recognition feed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

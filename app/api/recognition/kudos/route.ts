import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createKudos } from "@/lib/recognition/kudos"
import { db as pgClient } from "@/lib/database/pg-client"

// POST /api/recognition/kudos - Give kudos to one or more people
export async function POST(request: Request) {
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

    const body = await request.json()
    const { recipientIds, message, valueId, isPublic, points } = body

    if (!recipientIds?.length || !message?.trim()) {
      return NextResponse.json({ error: "Recipients and message are required" }, { status: 400 })
    }

    if (recipientIds.length > 10) {
      return NextResponse.json({ error: "Maximum 10 recipients per kudos" }, { status: 400 })
    }

    if (message.trim().length > 1000) {
      return NextResponse.json({ error: "Message too long (max 1000 characters)" }, { status: 400 })
    }

    const result = await createKudos({
      orgId: orgContext.orgId,
      giverId: authResult.user.id,
      recipientIds,
      message: message.trim(),
      valueId: valueId || null,
      isPublic: isPublic !== false,
      points: points || 1,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ kudosId: result.kudosId, success: true })
  } catch (error) {
    console.error("Error creating kudos:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/recognition/kudos - Get kudos given or received by user
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
    const type = searchParams.get("type") || "received" // "received" | "given"
    const userId = searchParams.get("userId") || authResult.user.id
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    let query: string
    let params: any[]

    if (type === "given") {
      query = `
        SELECT k.*, rv.name AS value_name, rv.emoji AS value_emoji, rv.color AS value_color,
               json_agg(json_build_object('user_id', ru.id, 'full_name', ru.full_name, 'avatar_url', ru.avatar_url)) AS recipients,
               (SELECT COUNT(*) FROM kudos_reactions kre WHERE kre.kudos_id = k.id) AS reaction_count,
               (SELECT COUNT(*) FROM kudos_comments kc WHERE kc.kudos_id = k.id) AS comment_count
        FROM kudos k
        JOIN kudos_recipients kr ON kr.kudos_id = k.id
        JOIN users ru ON ru.id = kr.user_id
        LEFT JOIN recognition_values rv ON rv.id = k.value_id
        WHERE k.giver_id = $1 AND k.org_id = $2
        GROUP BY k.id, rv.name, rv.emoji, rv.color
        ORDER BY k.created_at DESC
        LIMIT $3 OFFSET $4`
      params = [userId, orgContext.orgId, limit, offset]
    } else {
      query = `
        SELECT k.*, gu.full_name AS giver_name, gu.avatar_url AS giver_avatar,
               rv.name AS value_name, rv.emoji AS value_emoji, rv.color AS value_color,
               json_agg(json_build_object('user_id', ru.id, 'full_name', ru.full_name, 'avatar_url', ru.avatar_url)) AS recipients,
               (SELECT COUNT(*) FROM kudos_reactions kre WHERE kre.kudos_id = k.id) AS reaction_count,
               (SELECT COUNT(*) FROM kudos_comments kc WHERE kc.kudos_id = k.id) AS comment_count
        FROM kudos k
        JOIN kudos_recipients kr ON kr.kudos_id = k.id
        JOIN users ru ON ru.id = kr.user_id
        JOIN users gu ON gu.id = k.giver_id
        LEFT JOIN recognition_values rv ON rv.id = k.value_id
        WHERE kr.user_id = $1 AND k.org_id = $2
        GROUP BY k.id, gu.full_name, gu.avatar_url, rv.name, rv.emoji, rv.color
        ORDER BY k.created_at DESC
        LIMIT $3 OFFSET $4`
      params = [userId, orgContext.orgId, limit, offset]
    }

    const result = await pgClient.query(query, params)

    return NextResponse.json({ kudos: result.rows || [] })
  } catch (error) {
    console.error("Error fetching kudos:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

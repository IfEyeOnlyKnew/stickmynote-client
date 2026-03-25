import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// POST /api/recognition/kudos/[kudosId]/reactions - Toggle reaction on kudos
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kudosId: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { kudosId } = await params
    const body = await request.json()
    const reactionType = body.reactionType || "celebrate"

    // Check kudos exists in this org
    const kudosCheck = await pgClient.query(
      `SELECT id FROM kudos WHERE id = $1 AND org_id = $2`,
      [kudosId, orgContext.orgId]
    )
    if (!kudosCheck.rows?.length) {
      return NextResponse.json({ error: "Kudos not found" }, { status: 404 })
    }

    // Toggle: if exists, remove; if not, add
    const existing = await pgClient.query(
      `SELECT id FROM kudos_reactions WHERE kudos_id = $1 AND user_id = $2 AND reaction_type = $3`,
      [kudosId, authResult.user.id, reactionType]
    )

    if (existing.rows?.length > 0) {
      await pgClient.query(
        `DELETE FROM kudos_reactions WHERE kudos_id = $1 AND user_id = $2 AND reaction_type = $3`,
        [kudosId, authResult.user.id, reactionType]
      )
      return NextResponse.json({ action: "removed" })
    } else {
      await pgClient.query(
        `INSERT INTO kudos_reactions (kudos_id, user_id, reaction_type) VALUES ($1, $2, $3)`,
        [kudosId, authResult.user.id, reactionType]
      )
      return NextResponse.json({ action: "added" })
    }
  } catch (error) {
    console.error("Error toggling reaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/recognition/kudos/[kudosId]/reactions - Get reactions for a kudos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kudosId: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { kudosId } = await params

    const result = await pgClient.query(
      `SELECT kr.*, u.full_name, u.avatar_url
       FROM kudos_reactions kr
       JOIN users u ON u.id = kr.user_id
       WHERE kr.kudos_id = $1
       ORDER BY kr.created_at`,
      [kudosId]
    )

    return NextResponse.json({ reactions: result.rows || [] })
  } catch (error) {
    console.error("Error fetching reactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

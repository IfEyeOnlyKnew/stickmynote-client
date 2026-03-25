import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// POST /api/recognition/kudos/[kudosId]/comments - Add comment to kudos
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
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: "Comment too long (max 500 characters)" }, { status: 400 })
    }

    // Check kudos exists in this org
    const kudosCheck = await pgClient.query(
      `SELECT id FROM kudos WHERE id = $1 AND org_id = $2`,
      [kudosId, orgContext.orgId]
    )
    if (!kudosCheck.rows?.length) {
      return NextResponse.json({ error: "Kudos not found" }, { status: 404 })
    }

    const result = await pgClient.query(
      `INSERT INTO kudos_comments (kudos_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [kudosId, authResult.user.id, content.trim()]
    )

    return NextResponse.json({ comment: result.rows[0] })
  } catch (error) {
    console.error("Error adding comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/recognition/kudos/[kudosId]/comments - Get comments for a kudos
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
      `SELECT kc.*, u.full_name AS user_full_name, u.avatar_url AS user_avatar_url
       FROM kudos_comments kc
       JOIN users u ON u.id = kc.user_id
       WHERE kc.kudos_id = $1
       ORDER BY kc.created_at ASC`,
      [kudosId]
    )

    return NextResponse.json({ comments: result.rows || [] })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

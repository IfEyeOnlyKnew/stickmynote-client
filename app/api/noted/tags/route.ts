import { type NextRequest, NextResponse } from "next/server"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/noted/tags - List all tags for the org
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { orgContext } = auth

    const result = await pgClient.query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM noted_page_tags pt WHERE pt.tag_id = t.id) AS page_count
       FROM noted_tags t
       WHERE t.org_id = $1
       ORDER BY t.name ASC`,
      [orgContext.orgId]
    )

    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error("Failed to fetch tags:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/tags - Create a tag
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_tag_create")
    if (!allowed) return createRateLimitResponse()

    const body = await request.json()
    const { name, color, parent_id } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const result = await pgClient.query(
      `INSERT INTO noted_tags (org_id, name, color, parent_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgContext.orgId, name.trim(), color || "#6b7280", parent_id || null, user.id]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return NextResponse.json({ error: "Tag name already exists" }, { status: 409 })
    }
    console.error("Failed to create tag:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// PUT /api/noted/tags/[id] - Update a tag
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_tag_update")
    if (!allowed) return createRateLimitResponse()

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const body = await request.json()
    const { name, color, parent_id } = body

    const result = await pgClient.query(
      `UPDATE noted_tags SET
        name = COALESCE($1, name),
        color = COALESCE($2, color),
        parent_id = $3
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [name?.trim() || null, color || null, parent_id || null, params.id, orgContext.orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error("Failed to update tag:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/noted/tags/[id] - Delete a tag
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_tag_delete")
    if (!allowed) return createRateLimitResponse()

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const result = await pgClient.query(
      `DELETE FROM noted_tags WHERE id = $1 AND org_id = $2 RETURNING id`,
      [params.id, orgContext.orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to delete tag:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

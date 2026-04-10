import { type NextRequest, NextResponse } from "next/server"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/noted/pages/[id]/tags - Get tags for a page
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { orgContext } = auth

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const result = await pgClient.query(
      `SELECT t.* FROM noted_tags t
       JOIN noted_page_tags pt ON pt.tag_id = t.id
       WHERE pt.page_id = $1 AND t.org_id = $2
       ORDER BY t.name`,
      [params.id, orgContext.orgId]
    )

    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error("Failed to fetch page tags:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/pages/[id]/tags - Add a tag to a page (or create + add)
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_page_tag_add")
    if (!allowed) return createRateLimitResponse()

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const body = await request.json()
    const { tag_id, tag_name, color } = body

    let resolvedTagId = tag_id

    // If tag_name is provided instead of tag_id, create or find the tag
    if (!resolvedTagId && tag_name?.trim()) {
      const existing = await pgClient.query(
        `SELECT id FROM noted_tags WHERE org_id = $1 AND LOWER(name) = LOWER($2)`,
        [orgContext.orgId, tag_name.trim()]
      )
      if (existing.rows.length > 0) {
        resolvedTagId = existing.rows[0].id
      } else {
        const created = await pgClient.query(
          `INSERT INTO noted_tags (org_id, name, color, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [orgContext.orgId, tag_name.trim(), color || "#6b7280", user.id]
        )
        resolvedTagId = created.rows[0].id
      }
    }

    if (!resolvedTagId) {
      return NextResponse.json({ error: "tag_id or tag_name required" }, { status: 400 })
    }

    // Add the tag to the page (ignore if already exists)
    await pgClient.query(
      `INSERT INTO noted_page_tags (page_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (page_id, tag_id) DO NOTHING`,
      [params.id, resolvedTagId]
    )

    // Return all tags for the page
    const result = await pgClient.query(
      `SELECT t.* FROM noted_tags t
       JOIN noted_page_tags pt ON pt.tag_id = t.id
       WHERE pt.page_id = $1 AND t.org_id = $2
       ORDER BY t.name`,
      [params.id, orgContext.orgId]
    )

    return NextResponse.json({ data: result.rows }, { status: 201 })
  } catch (err) {
    console.error("Failed to add tag to page:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/noted/pages/[id]/tags - Remove a tag from a page
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const tagId = request.nextUrl.searchParams.get("tag_id")
    if (!tagId || !validateUUID(tagId)) {
      return NextResponse.json({ error: "tag_id query param required" }, { status: 400 })
    }

    await pgClient.query(
      `DELETE FROM noted_page_tags WHERE page_id = $1 AND tag_id = $2`,
      [params.id, tagId]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to remove tag from page:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

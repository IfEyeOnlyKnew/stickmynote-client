import { type NextRequest, NextResponse } from "next/server"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/noted/pages/[id]/versions - List all versions for a page
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    // Verify page access
    const pageCheck = await pgClient.query(
      `SELECT id FROM noted_pages WHERE id = $1 AND org_id = $2
       AND (
         (is_personal = true AND user_id = $3)
         OR (is_personal = false)
       )`,
      [params.id, orgContext.orgId, user.id]
    )
    if (pageCheck.rows.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    const result = await pgClient.query(
      `SELECT id, page_id, user_id, title, version_number, created_at,
              LENGTH(content) as content_length
       FROM noted_page_versions
       WHERE page_id = $1
       ORDER BY version_number DESC`,
      [params.id]
    )

    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error("Failed to fetch page versions:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/pages/[id]/versions - Create a version snapshot
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_version_create")
    if (!allowed) return createRateLimitResponse()

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    // Fetch the current page content
    const pageResult = await pgClient.query(
      `SELECT id, title, content, user_id FROM noted_pages
       WHERE id = $1 AND org_id = $2
       AND (
         (is_personal = true AND user_id = $3)
         OR (is_personal = false)
       )`,
      [params.id, orgContext.orgId, user.id]
    )
    if (pageResult.rows.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    const page = pageResult.rows[0]

    // Get next version number
    const versionResult = await pgClient.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM noted_page_versions WHERE page_id = $1`,
      [params.id]
    )
    const nextVersion = versionResult.rows[0].next_version

    // Insert version snapshot
    const insertResult = await pgClient.query(
      `INSERT INTO noted_page_versions (page_id, user_id, title, content, version_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, page_id, user_id, title, version_number, created_at`,
      [params.id, user.id, page.title || "", page.content || "", nextVersion]
    )

    return NextResponse.json({ data: insertResult.rows[0] }, { status: 201 })
  } catch (err) {
    console.error("Failed to create page version:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

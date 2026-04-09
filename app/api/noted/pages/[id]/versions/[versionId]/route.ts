import { type NextRequest, NextResponse } from "next/server"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/noted/pages/[id]/versions/[versionId] - Get a specific version with full content
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const params = await context.params
    if (!validateUUID(params.id) || !validateUUID(params.versionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    // Verify page access and get version
    const result = await pgClient.query(
      `SELECT v.* FROM noted_page_versions v
       JOIN noted_pages np ON np.id = v.page_id
       WHERE v.id = $1 AND v.page_id = $2 AND np.org_id = $3
       AND (
         (np.is_personal = true AND np.user_id = $4)
         OR (np.is_personal = false)
       )`,
      [params.versionId, params.id, orgContext.orgId, user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error("Failed to fetch page version:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/pages/[id]/versions/[versionId]/restore - Restore a version
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_version_restore")
    if (!allowed) return createRateLimitResponse()

    const params = await context.params
    if (!validateUUID(params.id) || !validateUUID(params.versionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    // Get the version to restore
    const versionResult = await pgClient.query(
      `SELECT v.* FROM noted_page_versions v
       JOIN noted_pages np ON np.id = v.page_id
       WHERE v.id = $1 AND v.page_id = $2 AND np.org_id = $3
       AND (
         (np.is_personal = true AND np.user_id = $4)
         OR (np.is_personal = false)
       )`,
      [params.versionId, params.id, orgContext.orgId, user.id]
    )

    if (versionResult.rows.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    const version = versionResult.rows[0]

    // Save current state as a new version before restoring
    const currentPage = await pgClient.query(
      `SELECT title, content FROM noted_pages WHERE id = $1`,
      [params.id]
    )
    if (currentPage.rows.length > 0) {
      const nextVersionResult = await pgClient.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM noted_page_versions WHERE page_id = $1`,
        [params.id]
      )
      await pgClient.query(
        `INSERT INTO noted_page_versions (page_id, user_id, title, content, version_number)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.id, user.id, currentPage.rows[0].title || "", currentPage.rows[0].content || "", nextVersionResult.rows[0].next_version]
      )
    }

    // Restore the version content to the page
    await pgClient.query(
      `UPDATE noted_pages SET title = $1, content = $2, updated_at = NOW()
       WHERE id = $3`,
      [version.title, version.content, params.id]
    )

    // Return the restored page
    const restored = await pgClient.query(
      `SELECT np.*,
        COALESCE(np.title, 'Untitled') as display_title
       FROM noted_pages np WHERE np.id = $1`,
      [params.id]
    )

    return NextResponse.json({ data: restored.rows[0] })
  } catch (err) {
    console.error("Failed to restore page version:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

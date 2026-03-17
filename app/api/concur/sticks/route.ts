import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/concur/sticks
 *
 * Returns a paginated feed of Concur sticks from ALL groups the user is a member of.
 * Uses cursor-based pagination (created_at) for infinite scroll.
 *
 * Query params:
 *   limit  - number of sticks to return (default 12, max 50)
 *   cursor - ISO timestamp cursor for pagination (sticks older than this)
 */
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 50)
    const cursor = searchParams.get("cursor") || null

    // Fetch sticks from all groups the user belongs to, newest first
    // Cursor-based pagination using created_at
    const result = await db.query(
      `SELECT
        cs.id,
        cs.group_id,
        cs.user_id,
        cs.topic,
        cs.content,
        cs.color,
        cs.is_pinned,
        cs.created_at,
        cs.updated_at,
        cg.name AS group_name,
        cg.settings AS group_settings,
        u.id AS author_id,
        u.full_name AS author_name,
        u.email AS author_email,
        u.avatar_url AS author_avatar_url,
        (SELECT COUNT(*)::int FROM concur_stick_replies csr WHERE csr.stick_id = cs.id) AS reply_count,
        (SELECT COUNT(*)::int FROM concur_stick_views csv WHERE csv.stick_id = cs.id) AS view_count
      FROM concur_sticks cs
      JOIN concur_group_members cgm ON cgm.group_id = cs.group_id
        AND cgm.user_id = $1
        AND cgm.org_id = $2
      JOIN concur_groups cg ON cg.id = cs.group_id
      LEFT JOIN users u ON u.id = cs.user_id
      WHERE cs.org_id = $2
        ${cursor ? "AND cs.created_at < $4" : ""}
      ORDER BY cs.created_at DESC
      LIMIT $3`,
      cursor ? [user.id, orgContext.orgId, limit + 1, cursor] : [user.id, orgContext.orgId, limit + 1]
    )

    const rows = result.rows || []
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows

    const sticks = pageRows.map((row: any) => ({
      id: row.id,
      group_id: row.group_id,
      group_name: row.group_name,
      group_logo_url: row.group_settings?.logo_url || null,
      group_header_image_url: row.group_settings?.header_image_url || null,
      topic: row.topic,
      content: row.content,
      color: row.color,
      is_pinned: row.is_pinned,
      created_at: row.created_at,
      updated_at: row.updated_at,
      reply_count: row.reply_count,
      view_count: row.view_count,
      user: {
        id: row.author_id,
        full_name: row.author_name,
        email: row.author_email,
        avatar_url: row.author_avatar_url,
      },
    }))

    const nextCursor = hasMore && pageRows.length > 0
      ? pageRows[pageRows.length - 1].created_at
      : null

    return NextResponse.json({ sticks, nextCursor, hasMore })
  } catch (error) {
    console.error("[ConcurSticksFeed] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch sticks" }, { status: 500 })
  }
}

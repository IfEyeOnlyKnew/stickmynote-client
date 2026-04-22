import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// GET /api/activity-feed - The current user's recent activity on their notes.
// Reads from `personal_sticks_activities`, which is populated by the
// `log_note_activity` trigger on inserts/updates/deletes of personal_sticks.
export async function GET(request: Request) {
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50", 10), 200)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0", 10), 0)

    // Map the trigger's raw activity_type values to the client's taxonomy.
    // Anything outside the known set (e.g. 'deleted') is excluded so the
    // feed stays coherent for the UI.
    const query = `
      SELECT
        psa.id,
        psa.personal_stick_id AS note_id,
        psa.user_id,
        CASE psa.activity_type
          WHEN 'created'  THEN 'note_created'
          WHEN 'updated'  THEN 'note_updated'
          WHEN 'replied'  THEN 'reply_added'
          WHEN 'shared'   THEN 'note_shared'
          WHEN 'tag_added' THEN 'tag_added'
          ELSE psa.activity_type
        END AS activity_type,
        psa.metadata,
        psa.created_at,
        ps.topic AS note_topic,
        ps.is_shared AS note_is_shared,
        u.full_name AS user_full_name,
        u.email AS user_email
      FROM personal_sticks_activities psa
      LEFT JOIN personal_sticks ps ON ps.id = psa.personal_stick_id
      LEFT JOIN users u ON u.id = psa.user_id
      WHERE psa.user_id = $1
        AND psa.activity_type IN ('created', 'updated', 'replied', 'shared', 'tag_added')
      ORDER BY psa.created_at DESC
      LIMIT $2 OFFSET $3
    `

    let activities: unknown[] = []
    try {
      const result = await db.query(query, [authResult.user.id, limit, offset])
      activities = result.rows || []
    } catch (queryError) {
      // Table may be missing or schema may have drifted. Log once and fall
      // through to an empty feed -- the UI handles the empty state cleanly
      // and erroring here blocks a header navigation.
      console.warn(
        "[activity-feed] query failed, returning empty feed:",
        (queryError as Error).message,
      )
    }

    return NextResponse.json({
      activities,
      hasMore: activities.length === limit,
    })
  } catch (error_) {
    console.error("[activity-feed] unexpected error:", error_)
    return NextResponse.json({ activities: [], hasMore: false })
  }
}

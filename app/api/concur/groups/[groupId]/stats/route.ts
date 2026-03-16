import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/concur/groups/[groupId]/stats
 *
 * Returns engagement statistics for the group. Only accessible to group owners.
 *
 * Returns:
 *   - overview: total sticks, replies, views, members
 *   - topSticks: most viewed sticks (top 10)
 *   - activeMembers: most active members by posts + replies (top 10)
 *   - activityByDay: sticks + replies per day for the last 30 days
 *   - memberEngagement: how many members have posted, replied, or viewed
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params

    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    if (!validateUUID(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
    }

    // Check that user is a group owner
    const ownerCheck = await db.query(
      `SELECT role FROM concur_group_members
       WHERE group_id = $1 AND user_id = $2 AND org_id = $3`,
      [groupId, user.id, orgContext.orgId]
    )

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== "owner") {
      return NextResponse.json({ error: "Only group owners can view stats" }, { status: 403 })
    }

    // Run all stats queries in parallel
    const [
      overviewResult,
      topSticksResult,
      activeMembersResult,
      activityByDayResult,
      engagementResult,
    ] = await Promise.all([
      // Overview counts
      db.query(
        `SELECT
          (SELECT COUNT(*)::int FROM concur_sticks WHERE group_id = $1) AS total_sticks,
          (SELECT COUNT(*)::int FROM concur_stick_replies csr
           JOIN concur_sticks cs ON cs.id = csr.stick_id WHERE cs.group_id = $1) AS total_replies,
          (SELECT COUNT(*)::int FROM concur_stick_views csv
           JOIN concur_sticks cs ON cs.id = csv.stick_id WHERE cs.group_id = $1) AS total_views,
          (SELECT COUNT(*)::int FROM concur_group_members WHERE group_id = $1) AS total_members`,
        [groupId]
      ),

      // Top 10 most viewed sticks
      db.query(
        `SELECT
          cs.id,
          cs.topic,
          cs.content,
          cs.created_at,
          u.full_name AS author_name,
          (SELECT COUNT(*)::int FROM concur_stick_views csv WHERE csv.stick_id = cs.id) AS view_count,
          (SELECT COUNT(*)::int FROM concur_stick_replies csr WHERE csr.stick_id = cs.id) AS reply_count
        FROM concur_sticks cs
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE cs.group_id = $1
        ORDER BY view_count DESC, reply_count DESC
        LIMIT 10`,
        [groupId]
      ),

      // Top 10 most active members (posts + replies)
      db.query(
        `SELECT
          u.id,
          u.full_name,
          u.email,
          u.avatar_url,
          COALESCE(sp.stick_count, 0)::int AS stick_count,
          COALESCE(rp.reply_count, 0)::int AS reply_count,
          (COALESCE(sp.stick_count, 0) + COALESCE(rp.reply_count, 0))::int AS total_activity
        FROM concur_group_members cgm
        JOIN users u ON u.id = cgm.user_id
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS stick_count
          FROM concur_sticks WHERE group_id = $1
          GROUP BY user_id
        ) sp ON sp.user_id = u.id
        LEFT JOIN (
          SELECT csr.user_id, COUNT(*) AS reply_count
          FROM concur_stick_replies csr
          JOIN concur_sticks cs ON cs.id = csr.stick_id
          WHERE cs.group_id = $1
          GROUP BY csr.user_id
        ) rp ON rp.user_id = u.id
        WHERE cgm.group_id = $1
        ORDER BY total_activity DESC
        LIMIT 10`,
        [groupId]
      ),

      // Activity by day (last 30 days)
      db.query(
        `WITH dates AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '29 days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS day
        )
        SELECT
          d.day,
          COALESCE(s.stick_count, 0)::int AS sticks,
          COALESCE(r.reply_count, 0)::int AS replies,
          COALESCE(v.view_count, 0)::int AS views
        FROM dates d
        LEFT JOIN (
          SELECT created_at::date AS day, COUNT(*) AS stick_count
          FROM concur_sticks WHERE group_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY day
        ) s ON s.day = d.day
        LEFT JOIN (
          SELECT csr.created_at::date AS day, COUNT(*) AS reply_count
          FROM concur_stick_replies csr
          JOIN concur_sticks cs ON cs.id = csr.stick_id
          WHERE cs.group_id = $1
            AND csr.created_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY day
        ) r ON r.day = d.day
        LEFT JOIN (
          SELECT csv.viewed_at::date AS day, COUNT(*) AS view_count
          FROM concur_stick_views csv
          JOIN concur_sticks cs ON cs.id = csv.stick_id
          WHERE cs.group_id = $1
            AND csv.viewed_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY day
        ) v ON v.day = d.day
        ORDER BY d.day ASC`,
        [groupId]
      ),

      // Member engagement breakdown
      db.query(
        `SELECT
          (SELECT COUNT(DISTINCT user_id)::int FROM concur_sticks WHERE group_id = $1) AS members_posted,
          (SELECT COUNT(DISTINCT csr.user_id)::int
           FROM concur_stick_replies csr
           JOIN concur_sticks cs ON cs.id = csr.stick_id
           WHERE cs.group_id = $1) AS members_replied,
          (SELECT COUNT(DISTINCT csv.user_id)::int
           FROM concur_stick_views csv
           JOIN concur_sticks cs ON cs.id = csv.stick_id
           WHERE cs.group_id = $1) AS members_viewed`,
        [groupId]
      ),
    ])

    const overview = overviewResult.rows[0]
    const engagement = engagementResult.rows[0]

    return NextResponse.json({
      overview: {
        totalSticks: overview.total_sticks,
        totalReplies: overview.total_replies,
        totalViews: overview.total_views,
        totalMembers: overview.total_members,
      },
      topSticks: topSticksResult.rows.map((row: any) => ({
        id: row.id,
        topic: row.topic,
        content: row.content?.substring(0, 100),
        createdAt: row.created_at,
        authorName: row.author_name,
        viewCount: row.view_count,
        replyCount: row.reply_count,
      })),
      activeMembers: activeMembersResult.rows.map((row: any) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        avatarUrl: row.avatar_url,
        stickCount: row.stick_count,
        replyCount: row.reply_count,
        totalActivity: row.total_activity,
      })),
      activityByDay: activityByDayResult.rows.map((row: any) => ({
        day: row.day,
        sticks: row.sticks,
        replies: row.replies,
        views: row.views,
      })),
      memberEngagement: {
        membersPosted: engagement.members_posted,
        membersReplied: engagement.members_replied,
        membersViewed: engagement.members_viewed,
        totalMembers: overview.total_members,
      },
    })
  } catch (error) {
    console.error("[ConcurGroupStats] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}

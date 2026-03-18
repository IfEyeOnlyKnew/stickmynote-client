// v2 Social Pads Analytics API: production-quality, get pad analytics
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-pads/[padId]/analytics - Get pad analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Check access
    const membershipResult = await db.query(
      `SELECT role, admin_level FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [padId, user.id, orgContext.orgId]
    )

    const padResult = await db.query(
      `SELECT owner_id, name FROM social_pads WHERE id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const pad = padResult.rows[0]

    if (membershipResult.rows.length === 0 && pad.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }

    // Get total sticks
    const sticksResult = await db.query(
      `SELECT COUNT(*) as count FROM social_sticks
       WHERE social_pad_id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )
    const totalSticks = parseInt(sticksResult.rows[0]?.count || '0', 10)

    // Get stick IDs for related queries
    const stickIdsResult = await db.query(
      `SELECT id FROM social_sticks WHERE social_pad_id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )
    const stickIds = stickIdsResult.rows.map((r: any) => r.id)

    // Get total replies
    let totalReplies = 0
    if (stickIds.length > 0) {
      const repliesResult = await db.query(
        `SELECT COUNT(*) as count FROM social_stick_replies
         WHERE social_stick_id = ANY($1) AND org_id = $2`,
        [stickIds, orgContext.orgId]
      )
      totalReplies = parseInt(repliesResult.rows[0]?.count || '0', 10)
    }

    // Get total reactions
    let totalReactions = 0
    if (stickIds.length > 0) {
      const reactionsResult = await db.query(
        `SELECT COUNT(*) as count FROM stick_reactions WHERE stick_id = ANY($1)`,
        [stickIds]
      )
      totalReactions = parseInt(reactionsResult.rows[0]?.count || '0', 10)
    }

    // Get total members
    const membersResult = await db.query(
      `SELECT COUNT(*) as count FROM social_pad_members
       WHERE social_pad_id = $1 AND accepted = true AND org_id = $2`,
      [padId, orgContext.orgId]
    )
    const totalMembers = parseInt(membersResult.rows[0]?.count || '0', 10)

    // Get sticks this week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const sticksWeekResult = await db.query(
      `SELECT COUNT(*) as count FROM social_sticks
       WHERE social_pad_id = $1 AND org_id = $2 AND created_at >= $3`,
      [padId, orgContext.orgId, oneWeekAgo.toISOString()]
    )
    const sticksThisWeek = parseInt(sticksWeekResult.rows[0]?.count || '0', 10)

    // Get sticks this month
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const sticksMonthResult = await db.query(
      `SELECT COUNT(*) as count FROM social_sticks
       WHERE social_pad_id = $1 AND org_id = $2 AND created_at >= $3`,
      [padId, orgContext.orgId, oneMonthAgo.toISOString()]
    )
    const sticksThisMonth = parseInt(sticksMonthResult.rows[0]?.count || '0', 10)

    // Get top contributors
    const contributorsResult = await db.query(
      `SELECT s.user_id, u.full_name, u.email, COUNT(s.id) as stick_count
       FROM social_sticks s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.social_pad_id = $1 AND s.org_id = $2
       GROUP BY s.user_id, u.full_name, u.email
       ORDER BY stick_count DESC
       LIMIT 5`,
      [padId, orgContext.orgId]
    )

    const topContributors = contributorsResult.rows.map((c: any) => ({
      user_id: c.user_id,
      full_name: c.full_name,
      email: c.email,
      stick_count: parseInt(c.stick_count, 10),
      reply_count: 0, // Could add this with a more complex query
    }))

    const engagementRate = totalMembers
      ? Math.round(((totalReplies + totalReactions) / (totalSticks || 1)) * 100)
      : 0

    return new Response(
      JSON.stringify({
        analytics: {
          pad_id: padId,
          pad_name: pad.name || '',
          total_sticks: totalSticks,
          total_replies: totalReplies,
          total_reactions: totalReactions,
          total_members: totalMembers,
          sticks_this_week: sticksThisWeek,
          sticks_this_month: sticksThisMonth,
          engagement_rate: engagementRate,
          top_contributors: topContributors,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

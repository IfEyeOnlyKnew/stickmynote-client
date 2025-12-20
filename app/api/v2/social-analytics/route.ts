// v2 Social Analytics API: production-quality, get social analytics
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

function getEmptyAnalyticsResponse() {
  return {
    overview: { totalPads: 0, publicPads: 0, privatePads: 0, totalSticks: 0, totalReplies: 0, totalMembers: 0, activeMembers: 0 },
    engagement: { replyRate: 0, averageRepliesPerStick: '0.0', recentActivity: 0 },
    mostActivePads: [],
    trends: { sticksThisWeek: 0, sticksLastWeek: 0, repliesThisWeek: 0, repliesLastWeek: 0, newMembersThisWeek: 0 },
    topContributors: [],
    activityByDay: [],
    contentStats: { averageStickLength: 0, averageReplyLength: 0, totalTags: 0, totalVideos: 0, totalImages: 0 },
  }
}

function getWeekBoundaries() {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(weekStart.getDate() - 7)
  return { now, weekStart, lastWeekStart }
}

// GET /api/v2/social-analytics - Get social analytics
export async function GET(request: NextRequest) {
  try {
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

    // Get owned pads
    const ownedPadsResult = await db.query(
      `SELECT id, is_public FROM social_pads WHERE owner_id = $1 AND org_id = $2`,
      [user.id, orgContext.orgId]
    )

    // Get member pads
    const memberPadsResult = await db.query(
      `SELECT spm.social_pad_id, sp.is_public
       FROM social_pad_members spm
       INNER JOIN social_pads sp ON sp.id = spm.social_pad_id
       WHERE spm.user_id = $1 AND spm.accepted = true AND spm.org_id = $2`,
      [user.id, orgContext.orgId]
    )

    const ownedPadIds = new Set(ownedPadsResult.rows.map((p: any) => p.id))
    const memberPads = memberPadsResult.rows.filter((m: any) => !ownedPadIds.has(m.social_pad_id))
    const uniquePadIds = new Set([
      ...ownedPadsResult.rows.map((p: any) => p.id),
      ...memberPads.map((m: any) => m.social_pad_id),
    ])
    const padIds = Array.from(uniquePadIds)

    if (padIds.length === 0) {
      return new Response(JSON.stringify(getEmptyAnalyticsResponse()), { status: 200 })
    }

    const padsCount = uniquePadIds.size
    const publicPadsCount = ownedPadsResult.rows.filter((p: any) => p.is_public).length
    const privatePadsCount = padsCount - publicPadsCount

    // Get sticks
    const sticksResult = await db.query(
      `SELECT ss.id, ss.social_pad_id, ss.topic, ss.content, ss.created_at, ss.user_id, sp.name as pad_name
       FROM social_sticks ss
       INNER JOIN social_pads sp ON sp.id = ss.social_pad_id
       WHERE ss.social_pad_id = ANY($1) AND ss.org_id = $2
       ORDER BY ss.created_at DESC`,
      [padIds, orgContext.orgId]
    )
    const sticksData = sticksResult.rows
    const totalSticks = sticksData.length
    const stickIds = sticksData.map((s: any) => s.id)

    // Get replies
    let repliesData: any[] = []
    let totalReplies = 0
    if (stickIds.length > 0) {
      const repliesResult = await db.query(
        `SELECT id, content, created_at, user_id FROM social_stick_replies
         WHERE social_stick_id = ANY($1) AND org_id = $2`,
        [stickIds, orgContext.orgId]
      )
      repliesData = repliesResult.rows
      totalReplies = repliesData.length
    }

    const { now, weekStart, lastWeekStart } = getWeekBoundaries()

    // Calculate trends
    const filterByDateRange = (items: any[], start: Date, end?: Date) =>
      items.filter((item) => {
        const date = new Date(item.created_at)
        return date >= start && (!end || date < end)
      })

    const trends = {
      sticksThisWeek: filterByDateRange(sticksData, weekStart).length,
      sticksLastWeek: filterByDateRange(sticksData, lastWeekStart, weekStart).length,
      repliesThisWeek: filterByDateRange(repliesData, weekStart).length,
      repliesLastWeek: filterByDateRange(repliesData, lastWeekStart, weekStart).length,
      newMembersThisWeek: 0,
    }

    // Build contributor map
    const contributorMap = new Map<string, { stickCount: number; replyCount: number }>()
    sticksData.forEach((stick: any) => {
      if (!stick.user_id) return
      const current = contributorMap.get(stick.user_id) || { stickCount: 0, replyCount: 0 }
      contributorMap.set(stick.user_id, { ...current, stickCount: current.stickCount + 1 })
    })
    repliesData.forEach((reply: any) => {
      if (!reply.user_id) return
      const current = contributorMap.get(reply.user_id) || { stickCount: 0, replyCount: 0 }
      contributorMap.set(reply.user_id, { ...current, replyCount: current.replyCount + 1 })
    })

    // Get top contributors
    const contributorIds = Array.from(contributorMap.keys()).slice(0, 10)
    let topContributors: any[] = []
    if (contributorIds.length > 0) {
      const usersResult = await db.query(
        `SELECT id, full_name as name, email FROM users WHERE id = ANY($1)`,
        [contributorIds]
      )
      const userMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))

      topContributors = Array.from(contributorMap.entries())
        .map(([userId, counts]) => {
          const userData = userMap.get(userId)
          return {
            userId,
            userName: userData?.name || null,
            userEmail: userData?.email || 'Unknown',
            stickCount: counts.stickCount,
            replyCount: counts.replyCount,
          }
        })
        .sort((a, b) => b.stickCount + b.replyCount - (a.stickCount + a.replyCount))
        .slice(0, 5)
    }

    // Calculate activity by day
    const activityByDay: { day: string; stickCount: number; replyCount: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(now.getDate() - i)
      day.setHours(0, 0, 0, 0)
      const nextDay = new Date(day)
      nextDay.setDate(day.getDate() + 1)

      const isInRange = (dateStr: string) => {
        const date = new Date(dateStr)
        return date >= day && date < nextDay
      }

      activityByDay.push({
        day: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        stickCount: sticksData.filter((s: any) => isInRange(s.created_at)).length,
        replyCount: repliesData.filter((r: any) => isInRange(r.created_at)).length,
      })
    }

    // Get most active pads
    const padActivityMap = new Map<string, { name: string; count: number }>()
    sticksData.forEach((stick: any) => {
      const padName = stick.pad_name || 'Unknown Pad'
      const current = padActivityMap.get(stick.social_pad_id) || { name: padName, count: 0 }
      padActivityMap.set(stick.social_pad_id, { name: padName, count: current.count + 1 })
    })
    const mostActivePads = Array.from(padActivityMap.entries())
      .map(([id, data]) => ({ padId: id, padName: data.name, stickCount: data.count }))
      .sort((a, b) => b.stickCount - a.stickCount)
      .slice(0, 5)

    // Calculate content stats
    const totalStickLength = sticksData.reduce((sum: number, s: any) => sum + (s.content?.length || 0), 0)
    const totalReplyLength = repliesData.reduce((sum: number, r: any) => sum + (r.content?.length || 0), 0)

    // Get member stats
    let membersCount = 0
    let activeMembersCount = 0
    if (padIds.length > 0) {
      const membersResult = await db.query(
        `SELECT user_id, updated_at, created_at FROM social_pad_members
         WHERE social_pad_id = ANY($1) AND accepted = true AND org_id = $2`,
        [padIds, orgContext.orgId]
      )
      const uniqueMembers = new Set(membersResult.rows.map((m: any) => m.user_id))
      membersCount = uniqueMembers.size

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      activeMembersCount = membersResult.rows.filter((m: any) => new Date(m.updated_at) > sevenDaysAgo).length
      trends.newMembersThisWeek = membersResult.rows.filter((m: any) => new Date(m.created_at) >= weekStart).length
    }

    // Recent activity
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentSticks = sticksData.filter((s: any) => new Date(s.created_at) > sevenDaysAgo).length

    return new Response(
      JSON.stringify({
        overview: {
          totalPads: padsCount,
          publicPads: publicPadsCount,
          privatePads: privatePadsCount,
          totalSticks,
          totalReplies,
          totalMembers: membersCount,
          activeMembers: activeMembersCount,
        },
        engagement: {
          replyRate: totalSticks > 0 ? totalReplies / totalSticks : 0,
          averageRepliesPerStick: totalSticks > 0 ? (totalReplies / totalSticks).toFixed(1) : '0.0',
          recentActivity: recentSticks,
        },
        mostActivePads,
        trends,
        topContributors,
        activityByDay,
        contentStats: {
          averageStickLength: totalSticks > 0 ? Math.round(totalStickLength / totalSticks) : 0,
          averageReplyLength: totalReplies > 0 ? Math.round(totalReplyLength / totalReplies) : 0,
          totalTags: 0,
          totalVideos: 0,
          totalImages: 0,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

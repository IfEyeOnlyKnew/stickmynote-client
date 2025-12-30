import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Types
interface StickData {
  id: string
  social_pad_id: string
  topic?: string
  content?: string
  created_at: string
  user_id?: string
  social_pads?: { name?: string }
}

interface ReplyData {
  id: string
  content?: string
  created_at: string
  user_id?: string
}

interface ContributorCounts {
  stickCount: number
  replyCount: number
}

// Helper: Get empty analytics response
function getEmptyAnalyticsResponse() {
  return {
    overview: { totalPads: 0, publicPads: 0, privatePads: 0, totalSticks: 0, totalReplies: 0, totalMembers: 0, activeMembers: 0 },
    engagement: { replyRate: 0, averageRepliesPerStick: "0.0", recentActivity: 0 },
    mostActivePads: [],
    trends: { sticksThisWeek: 0, sticksLastWeek: 0, repliesThisWeek: 0, repliesLastWeek: 0, newMembersThisWeek: 0 },
    topContributors: [],
    activityByDay: [],
    contentStats: { averageStickLength: 0, averageReplyLength: 0, totalTags: 0, totalVideos: 0, totalImages: 0 },
  }
}

// Helper: Calculate week boundaries
function getWeekBoundaries() {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(weekStart.getDate() - 7)
  return { now, weekStart, lastWeekStart }
}

// Helper: Calculate trends from data
function calculateTrends(sticksData: StickData[], repliesData: ReplyData[] | null, weekStart: Date, lastWeekStart: Date) {
  const filterByDateRange = <T extends { created_at: string }>(items: T[], start: Date, end?: Date) =>
    items.filter((item) => {
      const date = new Date(item.created_at)
      return date >= start && (!end || date < end)
    })

  return {
    sticksThisWeek: filterByDateRange(sticksData, weekStart).length,
    sticksLastWeek: filterByDateRange(sticksData, lastWeekStart, weekStart).length,
    repliesThisWeek: filterByDateRange(repliesData || [], weekStart).length,
    repliesLastWeek: filterByDateRange(repliesData || [], lastWeekStart, weekStart).length,
  }
}

// Helper: Build contributor map
function buildContributorMap(sticksData: StickData[], repliesData: ReplyData[] | null): Map<string, ContributorCounts> {
  const contributorMap = new Map<string, ContributorCounts>()

  sticksData.forEach((stick) => {
    if (!stick.user_id) return
    const current = contributorMap.get(stick.user_id) || { stickCount: 0, replyCount: 0 }
    contributorMap.set(stick.user_id, { ...current, stickCount: current.stickCount + 1 })
  })

  repliesData?.forEach((reply) => {
    if (!reply.user_id) return
    const current = contributorMap.get(reply.user_id) || { stickCount: 0, replyCount: 0 }
    contributorMap.set(reply.user_id, { ...current, replyCount: current.replyCount + 1 })
  })

  return contributorMap
}

// Helper: Get top contributors with user info
async function getTopContributors(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  contributorMap: Map<string, ContributorCounts>,
) {
  const contributorIds = Array.from(contributorMap.keys()).slice(0, 10)
  const { data: users } = await db.from("users").select("id, name, email").in("id", contributorIds)

  return Array.from(contributorMap.entries())
    .map(([userId, counts]) => {
      const userData = users?.find((u) => u.id === userId)
      return { userId, userName: userData?.name || null, userEmail: userData?.email || "Unknown", stickCount: counts.stickCount, replyCount: counts.replyCount }
    })
    .sort((a, b) => b.stickCount + b.replyCount - (a.stickCount + a.replyCount))
    .slice(0, 5)
}

// Helper: Calculate activity by day
function calculateActivityByDay(sticksData: StickData[], repliesData: ReplyData[] | null, now: Date) {
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
      day: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      stickCount: sticksData.filter((s) => isInRange(s.created_at)).length,
      replyCount: repliesData?.filter((r) => isInRange(r.created_at)).length || 0,
    })
  }

  return activityByDay
}

// Helper: Get most active pads
function getMostActivePads(sticksData: StickData[]) {
  const padActivityMap = new Map<string, { name: string; count: number }>()

  sticksData.forEach((stick) => {
    const padName = (stick.social_pads as { name?: string })?.name || "Unknown Pad"
    const current = padActivityMap.get(stick.social_pad_id) || { name: padName, count: 0 }
    padActivityMap.set(stick.social_pad_id, { name: padName, count: current.count + 1 })
  })

  return Array.from(padActivityMap.entries())
    .map(([id, data]) => ({ padId: id, padName: data.name, stickCount: data.count }))
    .sort((a, b) => b.stickCount - a.stickCount)
    .slice(0, 5)
}

// Helper: Fetch content stats counts
async function fetchContentStatsCounts(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  stickIds: string[],
  orgId: string,
) {
  const [tagsResult, videosResult, imagesResult] = await Promise.all([
    db.from("social_stick_tags").select("*", { count: "exact", head: true }).in("social_stick_id", stickIds).eq("org_id", orgId),
    db.from("social_stick_tabs").select("*", { count: "exact", head: true }).eq("tab_type", "video").eq("org_id", orgId).in("social_stick_id", stickIds),
    db.from("social_stick_tabs").select("*", { count: "exact", head: true }).eq("tab_type", "image").eq("org_id", orgId).in("social_stick_id", stickIds),
  ])

  return {
    totalTags: tagsResult.count || 0,
    totalVideos: videosResult.count || 0,
    totalImages: imagesResult.count || 0,
  }
}

// Helper: Calculate member stats
async function calculateMemberStats(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  padIds: string[],
  orgId: string,
  weekStart: Date,
) {
  if (padIds.length === 0) return { membersCount: 0, activeMembersCount: 0, newMembersThisWeek: 0 }

  const { data: members } = await db
    .from("social_pad_members")
    .select("user_id, updated_at, created_at")
    .in("social_pad_id", padIds)
    .eq("accepted", true)
    .eq("org_id", orgId)

  const uniqueMembers = new Set(members?.map((m) => m.user_id) || [])
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  return {
    membersCount: uniqueMembers.size,
    activeMembersCount: members?.filter((m) => new Date(m.updated_at) > sevenDaysAgo).length || 0,
    newMembersThisWeek: members?.filter((m) => new Date(m.created_at) >= weekStart).length || 0,
  }
}

export async function GET() {
  try {
    const db = await createDatabaseClient()

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

    const orgContext = await getOrgContext(authResult.user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { data: ownedPads } = await db
      .from("social_pads")
      .select("id, is_public")
      .eq("owner_id", authResult.user.id)
      .eq("org_id", orgContext.orgId)

    const { data: allMemberPads } = await db
      .from("social_pad_members")
      .select("social_pad_id")
      .eq("user_id", authResult.user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)

    const ownedPadIds = new Set(ownedPads?.map((p) => p.id) || [])
    const memberPads = allMemberPads?.filter((m: any) => !ownedPadIds.has(m.social_pad_id)) || []
    const uniquePadIds = new Set([...(ownedPads?.map((p) => p.id) || []), ...(memberPads?.map((m: any) => m.social_pad_id) || [])])
    const padIds = Array.from(uniquePadIds)

    if (padIds.length === 0) {
      return NextResponse.json(getEmptyAnalyticsResponse())
    }

    const padsCount = uniquePadIds.size
    const publicPadsCount = ownedPads?.filter((p) => p.is_public).length || 0
    const privatePadsCount = padsCount - publicPadsCount

    const { data: sticks } = await db
      .from("social_sticks")
      .select("id, social_pad_id, topic, content, created_at, user_id")
      .in("social_pad_id", padIds)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })

    // Fetch pad names separately
    let padNameMap = new Map<string, string>()
    if (padIds.length > 0) {
      const { data: pads } = await db
        .from("social_pads")
        .select("id, name")
        .in("id", padIds)
      for (const p of pads || []) {
        padNameMap.set(p.id, p.name)
      }
    }

    // Attach pad names to sticks
    const sticksData = ((sticks || []) as any[]).map((s) => ({
      ...s,
      social_pads: s.social_pad_id ? { name: padNameMap.get(s.social_pad_id) } : null,
    })) as StickData[]
    const totalSticks = sticksData.length
    const stickIds = sticksData.map((s) => s.id)

    const { count: repliesCount, data: repliesData } = await db
      .from("social_stick_replies")
      .select("id, content, created_at, user_id", { count: "exact" })
      .in("social_stick_id", stickIds)
      .eq("org_id", orgContext.orgId)

    const totalReplies = repliesCount || 0
    const { now, weekStart, lastWeekStart } = getWeekBoundaries()

    const trends = calculateTrends(sticksData, repliesData, weekStart, lastWeekStart)
    const contributorMap = buildContributorMap(sticksData, repliesData)
    const topContributors = await getTopContributors(db, contributorMap)
    const activityByDay = calculateActivityByDay(sticksData, repliesData, now)

    const totalStickLength = sticksData.reduce((sum, s) => sum + (s.content?.length || 0), 0)
    const totalReplyLength = repliesData?.reduce((sum, r) => sum + (r.content?.length || 0), 0) || 0

    const contentStatsCounts = await fetchContentStatsCounts(db, stickIds, orgContext.orgId)
    const memberStats = await calculateMemberStats(db, padIds, orgContext.orgId, weekStart)
    const mostActivePads = getMostActivePads(sticksData)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentSticks = sticksData.filter((s) => new Date(s.created_at) > sevenDaysAgo).length

    return NextResponse.json({
      overview: {
        totalPads: padsCount,
        publicPads: publicPadsCount,
        privatePads: privatePadsCount,
        totalSticks,
        totalReplies,
        totalMembers: memberStats.membersCount,
        activeMembers: memberStats.activeMembersCount,
      },
      engagement: {
        replyRate: totalSticks > 0 ? totalReplies / totalSticks : 0,
        averageRepliesPerStick: totalSticks > 0 ? (totalReplies / totalSticks).toFixed(1) : "0.0",
        recentActivity: recentSticks,
      },
      mostActivePads,
      trends: { ...trends, newMembersThisWeek: memberStats.newMembersThisWeek },
      topContributors,
      activityByDay,
      contentStats: {
        averageStickLength: totalSticks > 0 ? Math.round(totalStickLength / totalSticks) : 0,
        averageReplyLength: totalReplies > 0 ? Math.round(totalReplyLength / totalReplies) : 0,
        ...contentStatsCounts,
      },
    })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

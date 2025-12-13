import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
  try {
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { data: ownedPads } = await supabase
      .from("social_pads")
      .select("id, is_public")
      .eq("owner_id", user.id)
      .eq("org_id", orgContext.orgId)

    const { data: allMemberPads } = await supabase
      .from("social_pad_members")
      .select("social_pad_id, social_pads(is_public)")
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)

    const ownedPadIds = new Set(ownedPads?.map((p) => p.id) || [])
    const memberPads = allMemberPads?.filter((m) => !ownedPadIds.has(m.social_pad_id)) || []

    const uniquePadIds = new Set([
      ...(ownedPads?.map((p) => p.id) || []),
      ...(memberPads?.map((m) => m.social_pad_id) || []),
    ])

    const padsCount = uniquePadIds.size
    const publicPadsCount = ownedPads?.filter((p) => p.is_public).length || 0
    const privatePadsCount = padsCount - publicPadsCount

    const padIds = Array.from(uniquePadIds)
    let sticksData: any[] = []
    let totalSticks = 0
    let totalReplies = 0

    if (padIds.length > 0) {
      const { data: sticks } = await supabase
        .from("social_sticks")
        .select(`
          id, 
          social_pad_id, 
          topic, 
          content,
          created_at,
          user_id,
          social_pads(name)
        `)
        .in("social_pad_id", padIds)
        .eq("org_id", orgContext.orgId)
        .order("created_at", { ascending: false })

      sticksData = sticks || []
      totalSticks = sticksData.length

      const { count: repliesCount, data: repliesData } = await supabase
        .from("social_stick_replies")
        .select("id, content, created_at, user_id", { count: "exact" })
        .in(
          "social_stick_id",
          sticksData.map((s) => s.id),
        )
        .eq("org_id", orgContext.orgId)

      totalReplies = repliesCount || 0

      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const lastWeekStart = new Date(weekStart)
      lastWeekStart.setDate(weekStart.getDate() - 7)

      const sticksThisWeek = sticksData.filter((s) => new Date(s.created_at) >= weekStart).length
      const sticksLastWeek = sticksData.filter(
        (s) => new Date(s.created_at) >= lastWeekStart && new Date(s.created_at) < weekStart,
      ).length

      const repliesThisWeek = repliesData?.filter((r) => new Date(r.created_at) >= weekStart).length || 0
      const repliesLastWeek =
        repliesData?.filter((r) => new Date(r.created_at) >= lastWeekStart && new Date(r.created_at) < weekStart)
          .length || 0

      const contributorMap = new Map<string, { stickCount: number; replyCount: number }>()

      sticksData.forEach((stick) => {
        if (stick.user_id) {
          const current = contributorMap.get(stick.user_id) || { stickCount: 0, replyCount: 0 }
          contributorMap.set(stick.user_id, { ...current, stickCount: current.stickCount + 1 })
        }
      })

      repliesData?.forEach((reply) => {
        if (reply.user_id) {
          const current = contributorMap.get(reply.user_id) || { stickCount: 0, replyCount: 0 }
          contributorMap.set(reply.user_id, { ...current, replyCount: current.replyCount + 1 })
        }
      })

      const contributorIds = Array.from(contributorMap.keys()).slice(0, 10)
      const { data: users } = await supabase.from("users").select("id, name, email").in("id", contributorIds)

      const topContributors = Array.from(contributorMap.entries())
        .map(([userId, counts]) => {
          const userData = users?.find((u) => u.id === userId)
          return {
            userId,
            userName: userData?.name || null,
            userEmail: userData?.email || "Unknown",
            stickCount: counts.stickCount,
            replyCount: counts.replyCount,
          }
        })
        .sort((a, b) => b.stickCount + b.replyCount - (a.stickCount + a.replyCount))
        .slice(0, 5)

      const activityByDay = []
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now)
        day.setDate(now.getDate() - i)
        day.setHours(0, 0, 0, 0)

        const nextDay = new Date(day)
        nextDay.setDate(day.getDate() + 1)

        const daySticks = sticksData.filter((s) => {
          const date = new Date(s.created_at)
          return date >= day && date < nextDay
        }).length

        const dayReplies =
          repliesData?.filter((r) => {
            const date = new Date(r.created_at)
            return date >= day && date < nextDay
          }).length || 0

        activityByDay.push({
          day: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          stickCount: daySticks,
          replyCount: dayReplies,
        })
      }

      const totalStickLength = sticksData.reduce((sum, s) => sum + (s.content?.length || 0), 0)
      const totalReplyLength = repliesData?.reduce((sum, r) => sum + (r.content?.length || 0), 0) || 0

      const { count: tagsCount } = await supabase
        .from("social_stick_tags")
        .select("*", { count: "exact", head: true })
        .in(
          "social_stick_id",
          sticksData.map((s) => s.id),
        )
        .eq("org_id", orgContext.orgId)

      const { count: videosCount } = await supabase
        .from("social_stick_tabs")
        .select("*", { count: "exact", head: true })
        .eq("tab_type", "video")
        .eq("org_id", orgContext.orgId)
        .in(
          "social_stick_id",
          sticksData.map((s) => s.id),
        )

      const { count: imagesCount } = await supabase
        .from("social_stick_tabs")
        .select("*", { count: "exact", head: true })
        .eq("tab_type", "image")
        .eq("org_id", orgContext.orgId)
        .in(
          "social_stick_id",
          sticksData.map((s) => s.id),
        )

      const contentStats = {
        averageStickLength: totalSticks > 0 ? Math.round(totalStickLength / totalSticks) : 0,
        averageReplyLength: totalReplies > 0 ? Math.round(totalReplyLength / totalReplies) : 0,
        totalTags: tagsCount || 0,
        totalVideos: videosCount || 0,
        totalImages: imagesCount || 0,
      }

      let membersCount = 0
      let activeMembersCount = 0
      let newMembersThisWeek = 0
      if (padIds.length > 0) {
        const { data: members } = await supabase
          .from("social_pad_members")
          .select("user_id, updated_at, created_at")
          .in("social_pad_id", padIds)
          .eq("accepted", true)
          .eq("org_id", orgContext.orgId)

        const uniqueMembers = new Set(members?.map((m) => m.user_id) || [])
        membersCount = uniqueMembers.size

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        activeMembersCount = members?.filter((m) => new Date(m.updated_at) > sevenDaysAgo).length || 0

        newMembersThisWeek = members?.filter((m) => new Date(m.created_at) >= weekStart).length || 0
      }

      const padActivityMap = new Map<string, { name: string; count: number }>()
      sticksData.forEach((stick) => {
        const padName = (stick.social_pads as any)?.name || "Unknown Pad"
        const current = padActivityMap.get(stick.social_pad_id) || { name: padName, count: 0 }
        padActivityMap.set(stick.social_pad_id, { name: padName, count: current.count + 1 })
      })

      const mostActivePads = Array.from(padActivityMap.entries())
        .map(([id, data]) => ({ padId: id, padName: data.name, stickCount: data.count }))
        .sort((a, b) => b.stickCount - a.stickCount)
        .slice(0, 5)

      const replyRate = totalSticks > 0 ? totalReplies / totalSticks : 0

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
          totalMembers: membersCount,
          activeMembers: activeMembersCount,
        },
        engagement: {
          replyRate,
          averageRepliesPerStick: totalSticks > 0 ? (totalReplies / totalSticks).toFixed(1) : "0.0",
          recentActivity: recentSticks,
        },
        mostActivePads,
        trends: {
          sticksThisWeek,
          sticksLastWeek,
          repliesThisWeek,
          repliesLastWeek,
          newMembersThisWeek,
        },
        topContributors,
        activityByDay,
        contentStats,
      })
    }

    return NextResponse.json({
      overview: {
        totalPads: 0,
        publicPads: 0,
        privatePads: 0,
        totalSticks: 0,
        totalReplies: 0,
        totalMembers: 0,
        activeMembers: 0,
      },
      engagement: {
        replyRate: 0,
        averageRepliesPerStick: "0.0",
        recentActivity: 0,
      },
      mostActivePads: [],
      trends: {
        sticksThisWeek: 0,
        sticksLastWeek: 0,
        repliesThisWeek: 0,
        repliesLastWeek: 0,
        newMembersThisWeek: 0,
      },
      topContributors: [],
      activityByDay: [],
      contentStats: {
        averageStickLength: 0,
        averageReplyLength: 0,
        totalTags: 0,
        totalVideos: 0,
        totalImages: 0,
      },
    })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: { padId: string } }) {
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

    const { padId } = params

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role, admin_level")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const { data: pad } = await supabase
      .from("social_pads")
      .select("owner_id, name")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!membership && pad?.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { count: totalSticks } = await supabase
      .from("social_sticks")
      .select("*", { count: "exact", head: true })
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)

    const { data: stickIds } = await supabase
      .from("social_sticks")
      .select("id")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)

    let totalReplies = 0
    if (stickIds && stickIds.length > 0) {
      const { count: replyCount } = await supabase
        .from("social_stick_replies")
        .select("*", { count: "exact", head: true })
        .in(
          "social_stick_id",
          stickIds.map((s) => s.id),
        )
        .eq("org_id", orgContext.orgId)
      totalReplies = replyCount || 0
    }

    let totalReactions = 0
    if (stickIds && stickIds.length > 0) {
      const { count: reactionCount } = await supabase
        .from("stick_reactions")
        .select("*", { count: "exact", head: true })
        .in(
          "stick_id",
          stickIds.map((s) => s.id),
        )
      totalReactions = reactionCount || 0
    }

    const { count: totalMembers } = await supabase
      .from("social_pad_members")
      .select("*", { count: "exact", head: true })
      .eq("social_pad_id", padId)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const { count: sticksThisWeek } = await supabase
      .from("social_sticks")
      .select("*", { count: "exact", head: true })
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .gte("created_at", oneWeekAgo.toISOString())

    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const { count: sticksThisMonth } = await supabase
      .from("social_sticks")
      .select("*", { count: "exact", head: true })
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .gte("created_at", oneMonthAgo.toISOString())

    const { data: sticks } = await supabase
      .from("social_sticks")
      .select("user_id, users:user_id(id, full_name, email)")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)

    interface ContributorData {
      user: any
      stickCount: number
      replyCount: number
    }

    const contributorMap = new Map<string, ContributorData>()

    sticks?.forEach((stick: any) => {
      const userId = stick.user_id
      const userData = Array.isArray(stick.users) ? stick.users[0] : stick.users
      if (!contributorMap.has(userId)) {
        contributorMap.set(userId, { user: userData, stickCount: 0, replyCount: 0 })
      }
      const contributor = contributorMap.get(userId)
      if (contributor) contributor.stickCount++
    })

    if (stickIds && stickIds.length > 0) {
      const { data: replies } = await supabase
        .from("social_stick_replies")
        .select("user_id")
        .in(
          "social_stick_id",
          stickIds.map((s: { id: string }) => s.id),
        )
        .eq("org_id", orgContext.orgId)

      replies?.forEach((reply: { user_id: string }) => {
        const userId = reply.user_id
        if (contributorMap.has(userId)) {
          const contributor = contributorMap.get(userId)
          if (contributor) contributor.replyCount++
        }
      })
    }

    const topContributors = Array.from(contributorMap.entries())
      .map(([userId, data]) => ({
        user_id: userId,
        full_name: data.user?.full_name || null,
        email: data.user?.email || "",
        stick_count: data.stickCount,
        reply_count: data.replyCount,
      }))
      .sort((a, b) => b.stick_count + b.reply_count - (a.stick_count + a.reply_count))
      .slice(0, 5)

    const engagementRate = totalMembers ? ((totalReplies + totalReactions) / (totalSticks || 1)) * 100 : 0

    const analytics = {
      pad_id: padId,
      pad_name: pad?.name || "",
      total_sticks: totalSticks || 0,
      total_replies: totalReplies,
      total_reactions: totalReactions,
      total_members: totalMembers || 0,
      sticks_this_week: sticksThisWeek || 0,
      sticks_this_month: sticksThisMonth || 0,
      engagement_rate: Math.round(engagementRate),
      top_contributors: topContributors,
    }

    return NextResponse.json({ analytics })
  } catch (error) {
    console.error("Error fetching pad analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

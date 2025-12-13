import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

const ACTIVITY_RETENTION_DAYS = 90

export async function GET(req: NextRequest) {
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

    const searchParams = req.nextUrl.searchParams
    const limit = Number.parseInt(searchParams.get("limit") || "25")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const retentionDate = new Date()
    retentionDate.setDate(retentionDate.getDate() - ACTIVITY_RETENTION_DAYS)
    const retentionCutoff = retentionDate.toISOString()

    const { data: memberPads } = await supabase
      .from("social_pad_members")
      .select("social_pad_id")
      .eq("user_id", user.id)

    const { data: ownedPads } = await supabase
      .from("social_pads")
      .select("id")
      .eq("owner_id", user.id)
      .eq("org_id", orgContext.orgId)

    const padIds = [
      ...(memberPads?.map((m: { social_pad_id: string }) => m.social_pad_id) || []),
      ...(ownedPads?.map((p: { id: string }) => p.id) || []),
    ]

    if (padIds.length === 0) {
      return NextResponse.json({ activities: [], hasMore: false })
    }

    const fetchLimit = Math.max(limit * 3, 50)

    const { data: stickActivities } = await supabase
      .from("social_sticks")
      .select(
        `
        id,
        topic,
        content,
        created_at,
        social_pad_id,
        user_id,
        social_pads(name)
      `,
      )
      .in("social_pad_id", padIds)
      .eq("org_id", orgContext.orgId)
      .neq("user_id", user.id)
      .gte("created_at", retentionCutoff)
      .order("created_at", { ascending: false })
      .limit(fetchLimit)

    const { data: replyActivities } = await supabase
      .from("social_stick_replies")
      .select(
        `
        id,
        content,
        created_at,
        social_stick_id,
        user_id,
        social_sticks(id, topic, social_pad_id, user_id, social_pads(name))
      `,
      )
      .eq("org_id", orgContext.orgId)
      .neq("user_id", user.id)
      .gte("created_at", retentionCutoff)
      .order("created_at", { ascending: false })
      .limit(fetchLimit)

    // Filter replies to only those in the user's pads
    const filteredReplies =
      replyActivities?.filter((reply: any) => {
        const padId = reply.social_sticks?.social_pad_id
        return padId && padIds.includes(padId)
      }) || []

    const replyByStick = new Map<string, any>()
    filteredReplies.forEach((reply: any) => {
      const stickId = reply.social_stick_id
      const existing = replyByStick.get(stickId)
      if (!existing || new Date(reply.created_at) > new Date(existing.created_at)) {
        replyByStick.set(stickId, reply)
      }
    })
    const deduplicatedReplies = Array.from(replyByStick.values())

    const userIds = new Set<string>()
    stickActivities?.forEach((stick: any) => userIds.add(stick.user_id))
    deduplicatedReplies.forEach((reply: any) => userIds.add(reply.user_id))

    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email, avatar_url")
      .in("id", Array.from(userIds))

    const userMap = new Map(users?.map((u: any) => [u.id, u]) || [])

    const activities = [
      ...(stickActivities?.map((stick: any) => ({
        id: `stick-${stick.id}`,
        activity_type: "created",
        created_at: stick.created_at,
        user_id: stick.user_id,
        user: userMap.get(stick.user_id) || null,
        social_stick: {
          id: stick.id,
          topic: stick.topic,
          social_pad_id: stick.social_pad_id,
          social_pads: stick.social_pads,
        },
        metadata: {
          stick_topic: stick.topic,
          stick_id: stick.id,
          pad_name: stick.social_pads?.name,
          pad_id: stick.social_pad_id,
        },
      })) || []),
      ...(deduplicatedReplies.map((reply: any) => ({
        id: `reply-${reply.id}`,
        activity_type: "replied",
        created_at: reply.created_at,
        user_id: reply.user_id,
        user: userMap.get(reply.user_id) || null,
        social_stick: {
          id: reply.social_stick_id,
          topic: reply.social_sticks?.topic,
          social_pad_id: reply.social_sticks?.social_pad_id,
          social_pads: reply.social_sticks?.social_pads,
        },
        metadata: {
          reply_content: reply.content,
          stick_topic: reply.social_sticks?.topic,
          stick_id: reply.social_stick_id,
          pad_name: reply.social_sticks?.social_pads?.name,
          pad_id: reply.social_sticks?.social_pad_id,
        },
      })) || []),
    ]

    // Sort by created_at and apply pagination
    const sortedActivities = activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit)

    return NextResponse.json({
      activities: sortedActivities,
      hasMore: activities.length > offset + limit,
    })
  } catch (error) {
    console.error("[v0] Error in social activity feed route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

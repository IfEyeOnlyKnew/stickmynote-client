import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { data: readNotifications } = await supabase
      .from("social_notification_reads")
      .select("notification_key")
      .eq("user_id", user.id)

    const readKeys = new Set(readNotifications?.map((r: any) => r.notification_key) || [])

    const { data: memberPads } = await supabase
      .from("social_pad_members")
      .select("social_pad_id")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

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
      return NextResponse.json({ notifications: [] })
    }

    const { data: stickActivities } = await supabase
      .from("social_sticks")
      .select(`
        id,
        topic,
        content,
        created_at,
        social_pad_id,
        user_id,
        social_pads(name)
      `)
      .in("social_pad_id", padIds)
      .neq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })
      .limit(25)

    const { data: replyActivities } = await supabase
      .from("social_stick_replies")
      .select(`
        id,
        content,
        created_at,
        social_stick_id,
        user_id,
        social_sticks(id, topic, social_pad_id, user_id, social_pads(name))
      `)
      .neq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })
      .limit(25)

    const filteredReplies =
      replyActivities?.filter((reply: any) => {
        const padId = reply.social_sticks?.social_pad_id
        const stickOwnerId = reply.social_sticks?.user_id
        return (padId && padIds.includes(padId)) || stickOwnerId === user.id
      }) || []

    const userIds = new Set<string>()
    stickActivities?.forEach((stick: any) => userIds.add(stick.user_id))
    filteredReplies.forEach((reply: any) => userIds.add(reply.user_id))

    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email, avatar_url")
      .in("id", Array.from(userIds))

    const userMap = new Map(users?.map((u: any) => [u.id, u]) || [])

    const replyByStick = new Map()
    filteredReplies.forEach((reply: any) => {
      const stickId = reply.social_stick_id
      if (!replyByStick.has(stickId) || new Date(reply.created_at) > new Date(replyByStick.get(stickId).created_at)) {
        replyByStick.set(stickId, reply)
      }
    })

    const notifications = [
      ...(stickActivities?.map((stick: any) => {
        const notificationKey = `stick_${stick.id}`
        return {
          id: notificationKey,
          activity_type: "stick_created",
          note_id: stick.id,
          user_id: stick.user_id,
          created_at: stick.created_at,
          metadata: {
            stick_topic: stick.topic,
            pad_name: stick.social_pads?.name,
            read: readKeys.has(notificationKey),
          },
          users: userMap.get(stick.user_id) || null,
        }
      }) || []),
      ...Array.from(replyByStick.values()).map((reply: any) => {
        const notificationKey = `reply_${reply.id}`
        return {
          id: notificationKey,
          activity_type: "stick_replied",
          note_id: reply.social_stick_id,
          user_id: reply.user_id,
          created_at: reply.created_at,
          metadata: {
            reply_content: reply.content?.substring(0, 100),
            stick_topic: reply.social_sticks?.topic,
            pad_name: reply.social_sticks?.social_pads?.name,
            read: readKeys.has(notificationKey),
          },
          users: userMap.get(reply.user_id) || null,
        }
      }),
    ]

    const sortedNotifications = notifications.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    return NextResponse.json({ notifications: sortedNotifications.slice(0, 50) })
  } catch (error) {
    console.error("[v0] Error in social notifications route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

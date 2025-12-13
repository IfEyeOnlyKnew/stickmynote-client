import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// POST /api/social-notifications/mark-all-read - Mark all social notifications as read
export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

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
      return NextResponse.json({ success: true })
    }

    const { data: stickActivities } = await supabase
      .from("social_sticks")
      .select("id")
      .in("social_pad_id", padIds)
      .eq("org_id", orgContext.orgId)
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    const { data: replyActivities } = await supabase
      .from("social_stick_replies")
      .select("id, social_sticks!inner(social_pad_id, user_id)")
      .eq("org_id", orgContext.orgId)
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    const filteredReplies =
      replyActivities?.filter((reply: any) => {
        const padId = reply.social_sticks?.social_pad_id
        const stickOwnerId = reply.social_sticks?.user_id
        return (padId && padIds.includes(padId)) || stickOwnerId === user.id
      }) || []

    // Create notification keys for all activities
    const notificationKeys = [
      ...(stickActivities?.map((stick: any) => `stick_${stick.id}`) || []),
      ...filteredReplies.map((reply: any) => `reply_${reply.id}`),
    ]

    if (notificationKeys.length === 0) {
      return NextResponse.json({ success: true })
    }

    // Batch insert/upsert all as read
    const now = new Date().toISOString()
    const readRecords = notificationKeys.map((key) => ({
      user_id: user.id,
      notification_key: key,
      last_read_at: now,
    }))

    const { error: upsertError } = await supabase.from("social_notification_reads").upsert(readRecords, {
      onConflict: "user_id,notification_key",
    })

    if (upsertError) {
      console.error("[v0] Error marking all as read:", upsertError)
      return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 })
    }

    return NextResponse.json({ success: true, marked: notificationKeys.length })
  } catch (error) {
    console.error("[v0] Error in mark-all-read POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

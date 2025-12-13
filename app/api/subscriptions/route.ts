import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface ChannelPreferences {
  inApp?: boolean
  email?: boolean
  webhook?: boolean
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")

    let query = supabase.from("notification_subscriptions").select("*").eq("user_id", user.id)

    if (entityType) {
      query = query.eq("entity_type", entityType)
    }
    if (entityId) {
      query = query.eq("entity_id", entityId)
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching subscriptions:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const transformedData = data?.map((sub) => {
      const channels = (sub.channel_preferences as ChannelPreferences) || {}
      return {
        ...sub,
        channel_in_app: channels.inApp ?? true,
        channel_email: channels.email ?? false,
        channel_webhook: channels.webhook ?? false,
        notify_replies: true,
        notify_updates: true,
        notify_mentions: true,
        notify_status_changes: true,
      }
    })

    return NextResponse.json({ subscriptions: transformedData })
  } catch (error) {
    console.error("[v0] Subscriptions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const body = await request.json()
    const { entityType, entityId, channels } = body

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 })
    }

    const channelPreferences: ChannelPreferences = {
      inApp: channels?.inApp ?? true,
      email: channels?.email ?? false,
      webhook: channels?.webhook ?? false,
    }

    const { data, error } = await supabase
      .from("notification_subscriptions")
      .upsert(
        {
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          is_following: true,
          channel_preferences: channelPreferences,
          notification_level: "all",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,entity_type,entity_id",
        },
      )
      .select()
      .maybeSingle()

    if (error) {
      console.error("[v0] Error creating subscription:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 })
    }

    const channels2 = (data.channel_preferences as ChannelPreferences) || {}
    const transformed = {
      ...data,
      channel_in_app: channels2.inApp ?? true,
      channel_email: channels2.email ?? false,
      channel_webhook: channels2.webhook ?? false,
      notify_replies: true,
      notify_updates: true,
      notify_mentions: true,
      notify_status_changes: true,
    }

    return NextResponse.json({ subscription: transformed })
  } catch (error) {
    console.error("[v0] Subscriptions POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("notification_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)

    if (error) {
      console.error("[v0] Error deleting subscription:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Subscriptions DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

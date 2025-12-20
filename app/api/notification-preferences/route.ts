import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import type { NotificationPreferences } from "@/types/notification-preferences"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(req: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: preferences, error } = await db
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      // Table doesn't exist yet - return default preferences
      if (error.code === "PGRST205" || error.code === "42P01") {
        console.log("[v0] notification_preferences table not found, returning defaults")
        return NextResponse.json({
          preferences: {
            user_id: user.id,
            email_enabled: true,
            push_enabled: false,
            in_app_enabled: true,
            digest_frequency: "instant",
            digest_time: "09:00:00",
            digest_day_of_week: 1,
            stick_created_enabled: true,
            stick_updated_enabled: true,
            stick_replied_enabled: true,
            reaction_enabled: true,
            member_added_enabled: true,
            pad_invite_enabled: true,
            pad_preferences: {},
            muted_users: [],
          },
        })
      }
      console.error("Error fetching preferences:", error)
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
    }

    // If no preferences exist, create default ones
    if (!preferences) {
      const { data: newPreferences, error: insertError } = await db
        .from("notification_preferences")
        .insert({
          user_id: user.id,
        })
        .select()
        .maybeSingle()

      if (insertError) {
        console.error("Error creating preferences:", insertError)
        return NextResponse.json({ error: "Failed to create preferences" }, { status: 500 })
      }

      return NextResponse.json({ preferences: newPreferences })
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Error in notification preferences GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: Partial<NotificationPreferences> = await req.json()

    // Remove fields that shouldn't be updated directly
    const { id, user_id, created_at, ...updateData } = body as any

    const { data: preferences, error } = await db
      .from("notification_preferences")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .maybeSingle()

    if (error) {
      // Table doesn't exist yet - return success without saving
      if (error.code === "PGRST205" || error.code === "42P01") {
        console.warn("[v0] notification_preferences table not found, skipping save")
        return NextResponse.json({
          preferences: body,
          warning: "Preferences feature not yet initialized",
        })
      }
      console.error("Error updating preferences:", error)
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Error in notification preferences PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

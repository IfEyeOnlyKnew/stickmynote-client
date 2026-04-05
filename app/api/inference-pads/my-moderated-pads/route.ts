import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// ============================================================================
// GET - Fetch all pads where the user is a moderator or owner
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const userId = authResult.user.id
    const db = await createServiceDatabaseClient()

    // Get pads where user is owner
    const { data: ownedPads } = await db
      .from("social_pads")
      .select(`
        id,
        name,
        description,
        is_public,
        created_at
      `)
      .eq("owner_id", userId)

    // Get pads where user is a moderator (but not owner)
    const { data: moderatedPads } = await db
      .from("social_pad_chat_moderators")
      .select(`
        social_pad_id,
        is_active,
        can_pin,
        can_delete,
        can_mute,
        can_manage_settings,
        social_pads!social_pad_chat_moderators_social_pad_id_fkey (
          id,
          name,
          description,
          is_public,
          owner_id,
          created_at
        )
      `)
      .eq("user_id", userId)
      .eq("is_active", true)

    // Combine and format the results
    const allPads = new Map()

    // Add owned pads
    for (const pad of ownedPads || []) {
      allPads.set(pad.id, {
        ...pad,
        is_owner: true,
        permissions: {
          can_pin: true,
          can_delete: true,
          can_mute: true,
          can_manage_settings: true,
        },
      })
    }

    // Add moderated pads (if not already added as owner)
    for (const mod of moderatedPads || []) {
      if (mod.social_pads && !allPads.has(mod.social_pad_id)) {
        const pad = mod.social_pads
        allPads.set(mod.social_pad_id, {
          id: pad.id,
          name: pad.name,
          description: pad.description,
          is_public: pad.is_public,
          created_at: pad.created_at,
          is_owner: false,
          permissions: {
            can_pin: mod.can_pin,
            can_delete: mod.can_delete,
            can_mute: mod.can_mute,
            can_manage_settings: mod.can_manage_settings,
          },
        })
      }
    }

    // Get unread counts for each pad
    const padsWithCounts: Array<{
      id: string
      name: string
      description: string | null
      is_public: boolean
      created_at: string
      is_owner: boolean
      permissions: {
        can_pin: boolean
        can_delete: boolean
        can_mute: boolean
        can_manage_settings: boolean
      }
      recent_message_count: number
      last_message: {
        content: string
        created_at: string
        is_ai_message: boolean
      } | null
    }> = []
    for (const pad of allPads.values()) {
      // Count recent messages (last 24 hours)
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { count: recentMessageCount } = await db
        .from("social_pad_messages")
        .select("id", { count: "exact", head: true })
        .eq("social_pad_id", pad.id)
        .gte("created_at", twentyFourHoursAgo.toISOString())

      // Get last message
      const { data: lastMessage } = await db
        .from("social_pad_messages")
        .select("content, created_at, is_ai_message")
        .eq("social_pad_id", pad.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      padsWithCounts.push({
        ...pad,
        recent_message_count: recentMessageCount || 0,
        last_message: lastMessage
          ? {
              content: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? "..." : ""),
              created_at: lastMessage.created_at,
              is_ai_message: lastMessage.is_ai_message,
            }
          : null,
      })
    }

    // Sort by last message time (most recent first)
    padsWithCounts.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at
      const bTime = b.last_message?.created_at || b.created_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    return NextResponse.json({ pads: padsWithCounts })
  } catch (error) {
    console.error("[MyModeratedPads] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

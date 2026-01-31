import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { padChatCache } from "@/lib/cache/pad-chat-cache"

export const dynamic = "force-dynamic"

// ============================================================================
// Helpers
// ============================================================================

async function isPadOwner(db: any, padId: string, userId: string): Promise<boolean> {
  const { data: pad } = await db
    .from("social_pads")
    .select("owner_id")
    .eq("id", padId)
    .maybeSingle()

  return pad?.owner_id === userId
}

async function getUserByEmail(db: any, email: string): Promise<any> {
  const { data: user } = await db
    .from("users")
    .select("id, email, full_name, avatar_url")
    .eq("email", email.toLowerCase())
    .maybeSingle()

  return user
}

// ============================================================================
// GET - Fetch chat moderators
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    // Fetch moderators (without joins - we'll fetch users separately)
    const { data: moderators, error } = await db
      .from("social_pad_chat_moderators")
      .select("*")
      .eq("social_pad_id", padId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[ChatModerators] Error fetching moderators:", error)
    }

    // Also get pad owner
    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .single()

    // Collect all user IDs we need to fetch
    const userIds = new Set<string>()
    if (pad?.owner_id) userIds.add(pad.owner_id)
    if (moderators) {
      for (const mod of moderators) {
        userIds.add(mod.user_id)
        if (mod.added_by) userIds.add(mod.added_by)
      }
    }

    // Fetch all users in one query
    const { data: users } = await db
      .from("users")
      .select("id, email, full_name, avatar_url")
      .in("id", Array.from(userIds))

    type UserInfo = { id: string; email: string; full_name: string | null; avatar_url: string | null }
    const usersMap = new Map<string, UserInfo>(users?.map((u) => [u.id, u as UserInfo]) || [])

    // Build the moderators list
    const allModerators: Array<{
      id: string
      social_pad_id: string
      user_id: string
      can_pin: boolean
      can_delete: boolean
      can_mute: boolean
      can_manage_settings: boolean
      is_active: boolean
      user: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null
      is_owner?: boolean
      added_by?: string | null
      added_by_user?: { id: string; email: string; full_name: string | null } | null
      [key: string]: unknown
    }> = []

    // Add owner as first moderator with full permissions
    if (pad?.owner_id) {
      const ownerUser = usersMap.get(pad.owner_id)
      if (ownerUser) {
        allModerators.push({
          id: `owner-${pad.owner_id}`,
          social_pad_id: padId,
          user_id: pad.owner_id,
          can_pin: true,
          can_delete: true,
          can_mute: true,
          can_manage_settings: true,
          is_active: true,
          is_owner: true,
          user: ownerUser,
        })
      }
    }

    // Add explicit moderators (excluding owner if already added)
    if (moderators) {
      for (const mod of moderators) {
        if (mod.user_id !== pad?.owner_id) {
          const modUser = usersMap.get(mod.user_id)
          const addedByUser = mod.added_by ? usersMap.get(mod.added_by) : null
          allModerators.push({
            ...mod,
            is_owner: false,
            user: modUser || null,
            added_by_user: addedByUser || null,
          })
        }
      }
    }

    return NextResponse.json({ moderators: allModerators })
  } catch (error) {
    console.error("[ChatModerators] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Add a moderator
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    // Only pad owner can add moderators
    const isOwner = await isPadOwner(db, padId, authResult.user.id)
    if (!isOwner) {
      return NextResponse.json({ error: "Only pad owner can add moderators" }, { status: 403 })
    }

    const body = await request.json()
    const { email, permissions } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Find user by email
    const user = await getUserByEmail(db, email)
    if (!user) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 })
    }

    // Check if user is already an active moderator
    const { data: existing } = await db
      .from("social_pad_chat_moderators")
      .select("id, is_active")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing) {
      if (existing.is_active) {
        return NextResponse.json({ error: "User is already a moderator" }, { status: 400 })
      }
      // Reactivate existing moderator
      const { data: reactivated, error: reactivateError } = await db
        .from("social_pad_chat_moderators")
        .update({
          is_active: true,
          can_pin: permissions?.can_pin ?? true,
          can_delete: permissions?.can_delete ?? true,
          can_mute: permissions?.can_mute ?? true,
          can_manage_settings: permissions?.can_manage_settings ?? false,
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (reactivateError) {
        console.error("[ChatModerators] Error reactivating:", reactivateError)
        return NextResponse.json({ error: "Failed to add moderator" }, { status: 500 })
      }

      // Invalidate moderators cache
      await padChatCache.invalidateModerators(padId)

      return NextResponse.json({
        moderator: {
          ...reactivated,
          user,
        },
      })
    }

    // Add moderator
    const { data: moderator, error } = await db
      .from("social_pad_chat_moderators")
      .insert({
        social_pad_id: padId,
        user_id: user.id,
        added_by: authResult.user.id,
        can_pin: permissions?.can_pin ?? true,
        can_delete: permissions?.can_delete ?? true,
        can_mute: permissions?.can_mute ?? true,
        can_manage_settings: permissions?.can_manage_settings ?? false,
      })
      .select()
      .single()

    if (error) {
      console.error("[ChatModerators] Error adding:", error)
      return NextResponse.json({ error: "Failed to add moderator" }, { status: 500 })
    }

    // Invalidate moderators cache
    await padChatCache.invalidateModerators(padId)

    return NextResponse.json({
      moderator: {
        ...moderator,
        user,
      },
    })
  } catch (error) {
    console.error("[ChatModerators] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

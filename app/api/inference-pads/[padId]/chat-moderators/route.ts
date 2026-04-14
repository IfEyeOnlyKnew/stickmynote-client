import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { padChatCache } from "@/lib/cache/pad-chat-cache"
import { ensureUserProvisioned } from "@/lib/auth/ldap-auth"

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
// GET helpers
// ============================================================================

type UserInfo = { id: string; email: string; full_name: string | null; avatar_url: string | null }

function collectUserIds(pad: { owner_id?: string } | null, moderators: any[] | null): string[] {
  const userIds = new Set<string>()
  if (pad?.owner_id) userIds.add(pad.owner_id)
  if (moderators) {
    for (const mod of moderators) {
      userIds.add(mod.user_id)
      if (mod.added_by) userIds.add(mod.added_by)
    }
  }
  return Array.from(userIds)
}

function buildOwnerModerator(padId: string, ownerId: string, ownerUser: UserInfo) {
  return {
    id: `owner-${ownerId}`,
    social_pad_id: padId,
    user_id: ownerId,
    can_pin: true,
    can_delete: true,
    can_mute: true,
    can_manage_settings: true,
    is_active: true,
    is_owner: true,
    user: ownerUser,
  }
}

function buildModeratorsList(
  padId: string,
  pad: { owner_id?: string } | null,
  moderators: any[] | null,
  usersMap: Map<string, UserInfo>,
) {
  const allModerators: Record<string, unknown>[] = []

  if (pad?.owner_id) {
    const ownerUser = usersMap.get(pad.owner_id)
    if (ownerUser) {
      allModerators.push(buildOwnerModerator(padId, pad.owner_id, ownerUser))
    }
  }

  if (!moderators) return allModerators

  for (const mod of moderators) {
    if (mod.user_id === pad?.owner_id) continue
    allModerators.push({
      ...mod,
      is_owner: false,
      user: usersMap.get(mod.user_id) || null,
      added_by_user: mod.added_by ? usersMap.get(mod.added_by) || null : null,
    })
  }

  return allModerators
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

    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const db = await createServiceDatabaseClient()

    const { data: moderators, error } = await db
      .from("social_pad_chat_moderators")
      .select("*")
      .eq("social_pad_id", padId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[ChatModerators] Error fetching moderators:", error)
    }

    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .single()

    const userIds = collectUserIds(pad, moderators)

    const { data: users } = await db
      .from("users")
      .select("id, email, full_name, avatar_url")
      .in("id", userIds)

    const usersMap = new Map<string, UserInfo>(users?.map((u) => [u.id, u as UserInfo]) || [])
    const allModerators = buildModeratorsList(padId, pad, moderators, usersMap)

    return NextResponse.json({ moderators: allModerators })
  } catch (error) {
    console.error("[ChatModerators] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Add a moderator
// ============================================================================

// ============================================================================
// POST helpers
// ============================================================================

function buildPermissions(permissions: Record<string, boolean> | undefined) {
  return {
    can_pin: permissions?.can_pin ?? true,
    can_delete: permissions?.can_delete ?? true,
    can_mute: permissions?.can_mute ?? true,
    can_manage_settings: permissions?.can_manage_settings ?? false,
  }
}

async function reactivateModerator(
  db: any, existingId: string, padId: string, permissions: Record<string, boolean> | undefined, user: any,
): Promise<NextResponse> {
  const { data: reactivated, error: reactivateError } = await db
    .from("social_pad_chat_moderators")
    .update({ is_active: true, ...buildPermissions(permissions) })
    .eq("id", existingId)
    .select()
    .single()

  if (reactivateError) {
    console.error("[ChatModerators] Error reactivating:", reactivateError)
    return NextResponse.json({ error: "Failed to add moderator" }, { status: 500 })
  }

  await padChatCache.invalidateModerators(padId)
  return NextResponse.json({ moderator: { ...reactivated, user } })
}

async function insertModerator(
  db: any, padId: string, userId: string, addedBy: string, permissions: Record<string, boolean> | undefined, user: any,
): Promise<NextResponse> {
  const { data: moderator, error } = await db
    .from("social_pad_chat_moderators")
    .insert({
      social_pad_id: padId,
      user_id: userId,
      added_by: addedBy,
      ...buildPermissions(permissions),
    })
    .select()
    .single()

  if (error) {
    console.error("[ChatModerators] Error adding:", error)
    return NextResponse.json({ error: "Failed to add moderator" }, { status: 500 })
  }

  await padChatCache.invalidateModerators(padId)
  return NextResponse.json({ moderator: { ...moderator, user } })
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

    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const db = await createServiceDatabaseClient()

    const isOwner = await isPadOwner(db, padId, authResult.user.id)
    if (!isOwner) {
      return NextResponse.json({ error: "Only pad owner can add moderators" }, { status: 403 })
    }

    const body = await request.json()
    const { email, permissions } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const provisioned = await ensureUserProvisioned(email)
    if (!provisioned) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 })
    }
    const user = await getUserByEmail(db, provisioned.email)
    if (!user) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 })
    }

    const { data: existing } = await db
      .from("social_pad_chat_moderators")
      .select("id, is_active")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing?.is_active) {
      return NextResponse.json({ error: "User is already a moderator" }, { status: 400 })
    }

    if (existing) {
      return reactivateModerator(db, existing.id, padId, permissions, user)
    }

    return insertModerator(db, padId, user.id, authResult.user.id, permissions, user)
  } catch (error) {
    console.error("[ChatModerators] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

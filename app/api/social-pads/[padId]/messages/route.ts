import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// ============================================================================
// Types
// ============================================================================

interface PadMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  social_pad_id: string
}

interface UserInfo {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

// ============================================================================
// Helpers
// ============================================================================

async function verifyPadAccess(db: any, padId: string, userId: string): Promise<boolean> {
  // Check if pad exists and user has access
  const { data: pad } = await db
    .from("social_pads")
    .select("id, is_public, owner_id")
    .eq("id", padId)
    .maybeSingle()

  if (!pad) return false

  // Owner always has access
  if (pad.owner_id === userId) return true

  // Public pads are accessible to all
  if (pad.is_public) return true

  // Check if user is a member
  const { data: membership } = await db
    .from("social_pad_members")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .maybeSingle()

  return !!membership
}

async function fetchUserMap(db: any, userIds: string[]): Promise<Record<string, UserInfo>> {
  if (userIds.length === 0) return {}

  const { data: users } = await db
    .from("users")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds)

  if (!users) return {}

  return Object.fromEntries(users.map((u: UserInfo) => [u.id, u]))
}

// ============================================================================
// GET - Fetch pad messages
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

    // Verify access
    const hasAccess = await verifyPadAccess(db, padId, authResult.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch messages
    const { data: messages, error } = await db
      .from("social_pad_messages")
      .select("id, content, created_at, user_id, social_pad_id")
      .eq("social_pad_id", padId)
      .order("created_at", { ascending: true })
      .limit(100)

    if (error) {
      // Table might not exist yet - return empty array
      if (error.code === "42P01") {
        return NextResponse.json({ messages: [] })
      }
      console.error("[PadMessages] Error fetching:", error)
      return NextResponse.json({ messages: [] })
    }

    // Enrich with user data
    const userIds = [...new Set((messages || []).map((m: PadMessage) => m.user_id))] as string[]
    const usersMap = await fetchUserMap(db, userIds)

    const messagesWithUsers = (messages || []).map((msg: PadMessage) => ({
      ...msg,
      user: usersMap[msg.user_id] || null,
    }))

    return NextResponse.json({ messages: messagesWithUsers })
  } catch (error) {
    console.error("[PadMessages] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create a new message
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

    const user = authResult.user
    const db = await createServiceDatabaseClient()

    // Verify access
    const hasAccess = await verifyPadAccess(db, padId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Ensure the table exists (create if not)
    // This is a safety check - ideally the table should exist via migrations
    try {
      await db.rpc("ensure_social_pad_messages_table")
    } catch {
      // RPC might not exist, continue anyway
    }

    // Insert message
    const { data: message, error: insertError } = await db
      .from("social_pad_messages")
      .insert({
        social_pad_id: padId,
        user_id: user.id,
        content: content.trim(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("[PadMessages] Insert error:", insertError)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    // Fetch user info for the response
    const { data: userData } = await db
      .from("users")
      .select("id, email, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json({
      message: {
        ...message,
        user: userData,
      },
    })
  } catch (error) {
    console.error("[PadMessages] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

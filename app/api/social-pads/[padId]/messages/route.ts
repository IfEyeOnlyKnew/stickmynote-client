import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { generateChatResponse } from "@/lib/ai/chat-ai-responder"

export const dynamic = "force-dynamic"

// ============================================================================
// Types
// ============================================================================

interface PadMessage {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string
  social_pad_id: string
  is_pinned?: boolean
  pinned_by?: string | null
  pinned_at?: string | null
  is_edited?: boolean
  edited_at?: string | null
  is_deleted?: boolean
  deleted_by?: string | null
  reply_to_id?: string | null
  is_ai_message?: boolean
  is_system_message?: boolean
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

async function fetchModerators(db: any, padId: string): Promise<Set<string>> {
  // Get pad owner
  const { data: pad } = await db
    .from("social_pads")
    .select("owner_id")
    .eq("id", padId)
    .maybeSingle()

  const moderatorIds = new Set<string>()
  if (pad?.owner_id) {
    moderatorIds.add(pad.owner_id)
  }

  // Get active moderators
  const { data: moderators } = await db
    .from("social_pad_chat_moderators")
    .select("user_id")
    .eq("social_pad_id", padId)
    .eq("is_active", true)

  if (moderators) {
    for (const mod of moderators) {
      moderatorIds.add(mod.user_id)
    }
  }

  return moderatorIds
}

interface ReactionSummary {
  emoji: string
  count: number
  users: string[]
  user_reacted: boolean
}

async function fetchReactionsForMessages(
  db: any,
  messageIds: string[],
  currentUserId: string
): Promise<Record<string, ReactionSummary[]>> {
  if (messageIds.length === 0) return {}

  const { data: reactions, error } = await db
    .from("social_pad_message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", messageIds)

  if (error || !reactions) return {}

  // Group reactions by message
  const reactionsByMessage = new Map<string, Map<string, { count: number; users: string[]; user_reacted: boolean }>>()

  for (const reaction of reactions) {
    if (!reactionsByMessage.has(reaction.message_id)) {
      reactionsByMessage.set(reaction.message_id, new Map())
    }
    const messageReactions = reactionsByMessage.get(reaction.message_id)!
    if (!messageReactions.has(reaction.emoji)) {
      messageReactions.set(reaction.emoji, { count: 0, users: [], user_reacted: false })
    }
    const emojiData = messageReactions.get(reaction.emoji)!
    emojiData.count++
    emojiData.users.push(reaction.user_id)
    if (reaction.user_id === currentUserId) {
      emojiData.user_reacted = true
    }
  }

  // Convert to the expected format
  const result: Record<string, ReactionSummary[]> = {}
  for (const [messageId, emojiMap] of reactionsByMessage) {
    result[messageId] = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    }))
  }

  return result
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

    // Fetch messages with enhanced fields
    const { data: messages, error } = await db
      .from("social_pad_messages")
      .select("id, content, created_at, updated_at, user_id, social_pad_id, is_pinned, pinned_by, pinned_at, is_edited, edited_at, is_deleted, deleted_by, reply_to_id, is_ai_message, is_system_message")
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

    // Enrich with user data, moderator status, and reactions
    const userIds = [...new Set((messages || []).map((m: PadMessage) => m.user_id))] as string[]
    const messageIds = (messages || []).map((m: PadMessage) => m.id)

    const [usersMap, moderatorIds, reactionsMap] = await Promise.all([
      fetchUserMap(db, userIds),
      fetchModerators(db, padId),
      fetchReactionsForMessages(db, messageIds, authResult.user.id),
    ])

    const messagesWithUsers = (messages || []).map((msg: PadMessage) => ({
      ...msg,
      user: usersMap[msg.user_id]
        ? {
            ...usersMap[msg.user_id],
            is_moderator: moderatorIds.has(msg.user_id),
          }
        : null,
      reactions: reactionsMap[msg.id] || [],
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

    // Check if AI first-responder is enabled
    let aiMessage = null
    try {
      const { data: chatSettings } = await db
        .from("social_pad_chat_settings")
        .select("ai_enabled, ai_greeting, ai_auto_escalate")
        .eq("social_pad_id", padId)
        .maybeSingle()

      if (chatSettings?.ai_enabled) {
        // Fetch recent messages for context
        const { data: recentMessages } = await db
          .from("social_pad_messages")
          .select("content, is_ai_message, user_id")
          .eq("social_pad_id", padId)
          .order("created_at", { ascending: false })
          .limit(5)

        // Fetch pad name
        const { data: pad } = await db
          .from("social_pads")
          .select("name")
          .eq("id", padId)
          .maybeSingle()

        // Generate AI response
        const aiResponse = await generateChatResponse({
          padName: pad?.name || "Pad Chat",
          currentMessage: content.trim(),
          recentMessages: (recentMessages || []).reverse().map((m: any) => ({
            content: m.content,
            is_ai_message: m.is_ai_message || false,
          })),
          aiGreeting: chatSettings.ai_greeting,
        })

        // Insert AI response
        const { data: aiMessageData, error: aiInsertError } = await db
          .from("social_pad_messages")
          .insert({
            social_pad_id: padId,
            user_id: user.id, // Use the same user for now (will be filtered by is_ai_message)
            content: aiResponse.text,
            is_ai_message: true,
          })
          .select()
          .single()

        if (!aiInsertError && aiMessageData) {
          aiMessage = {
            ...aiMessageData,
            user: null, // AI messages don't have a user
          }
        }

        // If escalation is needed and auto-escalate is enabled, log it
        if (aiResponse.shouldEscalate && chatSettings.ai_auto_escalate) {
          console.log(`[PadChat AI] Escalation triggered for pad ${padId}: ${aiResponse.escalationReason}`)
          // TODO: Implement actual moderator notification (email, push, etc.)
        }
      }
    } catch (aiError) {
      // Log but don't fail the request if AI fails
      console.error("[PadChat AI] Error generating AI response:", aiError)
    }

    return NextResponse.json({
      message: {
        ...message,
        user: userData,
      },
      aiMessage, // Include AI response if generated
    })
  } catch (error) {
    console.error("[PadMessages] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

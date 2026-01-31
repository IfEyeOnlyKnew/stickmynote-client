import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { generateChatResponse } from "@/lib/ai/chat-ai-responder"
import { padChatCache, type CachedSettings, type CachedUserInfo } from "@/lib/cache/pad-chat-cache"

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

interface PadAccessInfo {
  hasAccess: boolean
  ownerId: string | null
  isPublic: boolean
}

// ============================================================================
// Helpers - Optimized for Scale
// ============================================================================

/**
 * Verify pad access and return owner info in a single query
 * This combines what was previously 2 queries into 1
 */
async function verifyPadAccessWithInfo(
  db: any,
  padId: string,
  userId: string
): Promise<PadAccessInfo> {
  // Single query to get pad info
  const { data: pad } = await db
    .from("social_pads")
    .select("id, is_public, owner_id")
    .eq("id", padId)
    .maybeSingle()

  if (!pad) return { hasAccess: false, ownerId: null, isPublic: false }

  // Owner always has access
  if (pad.owner_id === userId) {
    return { hasAccess: true, ownerId: pad.owner_id, isPublic: pad.is_public }
  }

  // Public pads are accessible to all
  if (pad.is_public) {
    return { hasAccess: true, ownerId: pad.owner_id, isPublic: true }
  }

  // Check membership only if needed
  const { data: membership } = await db
    .from("social_pad_members")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .maybeSingle()

  return {
    hasAccess: !!membership,
    ownerId: pad.owner_id,
    isPublic: false,
  }
}

/**
 * Fetch moderator IDs - returns owner + explicit moderators
 * Uses cache when available for faster lookups
 */
async function fetchModeratorIds(
  db: any,
  padId: string,
  knownOwnerId?: string | null
): Promise<Set<string>> {
  // Try cache first
  const cached = await padChatCache.getModerators(padId)
  if (cached) {
    const moderatorIds = new Set<string>(cached.ids)
    if (cached.ownerId) moderatorIds.add(cached.ownerId)
    return moderatorIds
  }

  const moderatorIds = new Set<string>()

  // Add known owner if provided
  if (knownOwnerId) {
    moderatorIds.add(knownOwnerId)
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

  // Cache the result
  await padChatCache.setModerators(padId, {
    ids: Array.from(moderatorIds),
    ownerId: knownOwnerId || null,
  })

  return moderatorIds
}

async function fetchUserMap(db: any, userIds: string[]): Promise<Record<string, UserInfo>> {
  if (userIds.length === 0) return {}

  // Check cache first
  const cachedUsers = await padChatCache.getUsers(userIds)
  const missingIds = userIds.filter(id => !cachedUsers.has(id))

  // Fetch missing users from DB
  let dbUsers: UserInfo[] = []
  if (missingIds.length > 0) {
    const { data } = await db
      .from("users")
      .select("id, email, full_name, avatar_url")
      .in("id", missingIds)

    if (data) {
      dbUsers = data
      // Cache the fetched users
      await padChatCache.setUsers(dbUsers as CachedUserInfo[])
    }
  }

  // Combine cached and fetched users
  const result: Record<string, UserInfo> = {}
  for (const [id, user] of cachedUsers) {
    result[id] = user
  }
  for (const user of dbUsers) {
    result[user.id] = user
  }

  return result
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
// GET - Fetch pad messages (Optimized with pagination)
// ============================================================================
//
// Query Parameters:
//   - limit: number (default 50, max 100) - messages to fetch
//   - after: string - cursor (message ID) to fetch messages after
//   - before: string - cursor (message ID) to fetch messages before
//
// For polling, use: ?after=<lastMessageId> to only get new messages
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

    const userId = authResult.user.id
    const db = await createServiceDatabaseClient()

    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const limitParam = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100)
    const afterCursor = searchParams.get("after") // Message ID to fetch after
    const beforeCursor = searchParams.get("before") // Message ID to fetch before

    // Step 1: Verify access and get pad info (combined query)
    const accessInfo = await verifyPadAccessWithInfo(db, padId, userId)
    if (!accessInfo.hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Step 2: Parallel fetch - settings (with cache) and moderators
    const [chatSettings, moderatorIds] = await Promise.all([
      (async () => {
        // Try cache first for settings
        const cached = await padChatCache.getSettings(padId)
        if (cached) return cached

        const { data } = await db
          .from("social_pad_chat_settings")
          .select("private_conversations, chat_enabled, ai_enabled")
          .eq("social_pad_id", padId)
          .maybeSingle()

        if (data) {
          await padChatCache.setSettings(padId, data as CachedSettings)
        }
        return data
      })(),
      fetchModeratorIds(db, padId, accessInfo.ownerId),
    ])

    const isModerator = moderatorIds.has(userId)
    const isPrivateMode = chatSettings?.private_conversations === true && !isModerator

    // Step 3: Build optimized message query
    let query = db
      .from("social_pad_messages")
      .select("id, content, created_at, updated_at, user_id, social_pad_id, is_pinned, pinned_by, pinned_at, is_edited, edited_at, is_deleted, deleted_by, reply_to_id, is_ai_message, is_system_message")
      .eq("social_pad_id", padId)

    // Apply cursor-based pagination
    if (afterCursor) {
      // Get the timestamp of the cursor message for efficient filtering
      const { data: cursorMsg } = await db
        .from("social_pad_messages")
        .select("created_at")
        .eq("id", afterCursor)
        .single()

      if (cursorMsg) {
        query = query.gt("created_at", cursorMsg.created_at)
      }
    } else if (beforeCursor) {
      const { data: cursorMsg } = await db
        .from("social_pad_messages")
        .select("created_at")
        .eq("id", beforeCursor)
        .single()

      if (cursorMsg) {
        query = query.lt("created_at", cursorMsg.created_at)
      }
    }

    // For private mode, filter at database level where possible
    if (isPrivateMode) {
      // Database-level filter: user's own messages OR pinned OR AI messages
      // Note: reply_to filtering requires post-processing due to complexity
      query = query.or(`user_id.eq.${userId},is_pinned.eq.true,is_ai_message.eq.true`)
    }

    query = query
      .order("created_at", { ascending: !beforeCursor }) // Reverse for "before" pagination
      .limit(limitParam)

    const { data: messages, error } = await query

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ messages: [], hasMore: false, nextCursor: null })
      }
      console.error("[PadMessages] Error fetching:", error)
      return NextResponse.json({ messages: [], hasMore: false, nextCursor: null })
    }

    // Reverse if we fetched "before" (to maintain chronological order)
    let filteredMessages: PadMessage[] = beforeCursor ? (messages || []).reverse() : (messages || [])

    // Step 4: Additional filtering for private mode (reply_to logic)
    // This handles moderator replies to user's messages
    if (isPrivateMode && filteredMessages.length > 0) {
      const ownMessageIds = new Set(
        filteredMessages
          .filter((m: PadMessage) => m.user_id === userId)
          .map((m: PadMessage) => m.id)
      )

      filteredMessages = filteredMessages.filter((msg: PadMessage) => {
        // Already filtered at DB level: own messages, pinned, AI
        if (msg.user_id === userId) return true
        if (msg.is_pinned) return true

        // AI messages that follow user's messages (context-aware)
        if (msg.is_ai_message) {
          const msgIndex = filteredMessages.findIndex((m: PadMessage) => m.id === msg.id)
          if (msgIndex > 0) {
            const prevMsg = filteredMessages[msgIndex - 1]
            if (prevMsg.user_id === userId) return true
          }
          // Also allow if it's a reply to user's message
          if (msg.reply_to_id && ownMessageIds.has(msg.reply_to_id)) return true
        }

        // Moderator replies to user's messages
        if (msg.reply_to_id && ownMessageIds.has(msg.reply_to_id)) {
          return moderatorIds.has(msg.user_id)
        }

        return false
      })
    }

    // Step 5: Parallel fetch user data and reactions
    const userIds = [...new Set(filteredMessages.map((m: PadMessage) => m.user_id))] as string[]
    const messageIds = filteredMessages.map((m: PadMessage) => m.id)

    const [usersMap, reactionsMap] = await Promise.all([
      fetchUserMap(db, userIds),
      fetchReactionsForMessages(db, messageIds, userId),
    ])

    // Step 6: Build response with pagination info
    const messagesWithUsers = filteredMessages.map((msg: PadMessage) => ({
      ...msg,
      user: usersMap[msg.user_id]
        ? {
            ...usersMap[msg.user_id],
            is_moderator: moderatorIds.has(msg.user_id),
          }
        : null,
      reactions: reactionsMap[msg.id] || [],
    }))

    // Determine pagination cursors
    const hasMore = filteredMessages.length === limitParam
    const nextCursor = filteredMessages.length > 0
      ? filteredMessages[filteredMessages.length - 1].id
      : null
    const prevCursor = filteredMessages.length > 0
      ? filteredMessages[0].id
      : null

    return NextResponse.json({
      messages: messagesWithUsers,
      hasMore,
      nextCursor,
      prevCursor,
      isPrivateMode, // Let client know filtering is active
    })
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

    // Verify access (optimized)
    const accessInfo = await verifyPadAccessWithInfo(db, padId, user.id)
    if (!accessInfo.hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const { content, reply_to_id } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Insert message with optional reply_to_id
    const insertData: Record<string, unknown> = {
      social_pad_id: padId,
      user_id: user.id,
      content: content.trim(),
    }

    if (reply_to_id) {
      insertData.reply_to_id = reply_to_id
    }

    const { data: message, error: insertError } = await db
      .from("social_pad_messages")
      .insert(insertData)
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

        // Insert AI response with reply_to pointing to user's message
        const { data: aiMessageData, error: aiInsertError } = await db
          .from("social_pad_messages")
          .insert({
            social_pad_id: padId,
            user_id: user.id, // Use the same user for now (will be filtered by is_ai_message)
            content: aiResponse.text,
            is_ai_message: true,
            reply_to_id: message.id, // Link AI response to user's message
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

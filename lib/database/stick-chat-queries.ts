/**
 * Stick Chat Database Queries
 * Type-safe query functions for the stick chat system
 */

import { db, queryOne, queryMany, execute } from "./pg-client"
import type { QueryResultRow } from "pg"
import type {
  StickChat,
  StickChatWithDetails,
  StickChatMember,
  StickChatMemberWithUser,
  StickChatMessage,
  StickChatMessageWithUser,
  StickType,
  StickChatFilters,
  ChatType,
  ChatVisibility,
  MemberRole,
  MessageType,
  ChannelCategory,
  ReactionSummary,
  VoiceParticipant,
  PinnedMessage,
} from "@/types/stick-chat"

// ==================== STICK CHATS ====================

export interface StickChatRow extends QueryResultRow {
  id: string
  name: string | null
  stick_id: string | null
  stick_type: StickType | null
  owner_id: string
  org_id: string | null
  is_group: boolean
  created_at: string
  updated_at: string
  expires_at: string
  chat_type: ChatType
  visibility: ChatVisibility
  description: string | null
  category_id: string | null
  topic: string | null
  sort_order: number
  is_archived: boolean
  livekit_room_name: string | null
  voice_active_participants: number
}

/**
 * Get all chats for a user (where they are a member or owner)
 */
export async function getUserChats(
  userId: string,
  orgId: string | null,
  filters?: StickChatFilters
): Promise<StickChatWithDetails[]> {
  const params: any[] = [userId]
  let paramIndex = 2

  // Build additional filter conditions
  // Note: We don't filter by org_id for chats because users should see all chats
  // they're explicitly invited to, regardless of which org context they're in
  let filterConditions = ""

  if (filters?.stick_id) {
    filterConditions += ` AND sc.stick_id = $${paramIndex}`
    params.push(filters.stick_id)
    paramIndex++
  }

  if (filters?.stick_type) {
    filterConditions += ` AND sc.stick_type = $${paramIndex}`
    params.push(filters.stick_type)
    paramIndex++
  }

  if (filters?.is_group !== undefined) {
    filterConditions += ` AND sc.is_group = $${paramIndex}`
    params.push(filters.is_group)
    paramIndex++
  }

  const expiryCondition = filters?.include_expired ? "" : "AND sc.expires_at > NOW()"

  const query = `
    SELECT
      sc.*,
      u.id as owner_user_id,
      u.username as owner_username,
      u.email as owner_email,
      u.full_name as owner_full_name,
      u.avatar_url as owner_avatar_url,
      (
        SELECT content FROM stick_chat_messages
        WHERE chat_id = sc.id
        ORDER BY created_at DESC
        LIMIT 1
      ) as last_message_content,
      (
        SELECT created_at FROM stick_chat_messages
        WHERE chat_id = sc.id
        ORDER BY created_at DESC
        LIMIT 1
      ) as last_message_at,
      (
        SELECT COUNT(*) FROM stick_chat_messages
        WHERE chat_id = sc.id
        AND created_at > COALESCE(
          (SELECT last_read_at FROM stick_chat_members WHERE chat_id = sc.id AND user_id = $1),
          '1970-01-01'::timestamp
        )
      )::int as unread_count,
      COALESCE(ps.topic, ss.topic) as stick_topic
    FROM stick_chats sc
    LEFT JOIN users u ON sc.owner_id = u.id
    LEFT JOIN personal_sticks ps ON sc.stick_id = ps.id AND sc.stick_type = 'personal'
    LEFT JOIN social_sticks ss ON sc.stick_id = ss.id AND sc.stick_type = 'social'
    WHERE sc.id IN (
      SELECT chat_id FROM stick_chat_members WHERE user_id = $1
      UNION
      SELECT id FROM stick_chats WHERE owner_id = $1
    )
    ${expiryCondition}
    ${filterConditions}
    ORDER BY sc.updated_at DESC
  `

  const rows = await queryMany<any>(query, params)

  // Transform rows to StickChatWithDetails
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    stick_id: row.stick_id,
    stick_type: row.stick_type,
    owner_id: row.owner_id,
    org_id: row.org_id,
    is_group: row.is_group,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    chat_type: row.chat_type || "chat",
    visibility: row.visibility || "private",
    description: row.description || null,
    category_id: row.category_id || null,
    topic: row.topic || null,
    sort_order: row.sort_order || 0,
    is_archived: row.is_archived || false,
    livekit_room_name: row.livekit_room_name || null,
    voice_active_participants: row.voice_active_participants || 0,
    owner: row.owner_user_id
      ? {
          id: row.owner_user_id,
          username: row.owner_username,
          email: row.owner_email,
          full_name: row.owner_full_name,
          avatar_url: row.owner_avatar_url,
        }
      : undefined,
    last_message: row.last_message_content
      ? {
          id: "",
          chat_id: row.id,
          user_id: "",
          content: row.last_message_content,
          created_at: row.last_message_at,
          updated_at: row.last_message_at,
          parent_message_id: null, thread_reply_count: 0, thread_last_reply_at: null,
          is_edited: false, edit_history: [], forwarded_from_id: null,
          quoted_message_id: null, message_type: "text" as const, metadata: {},
        }
      : undefined,
    unread_count: row.unread_count || 0,
    stick_topic: row.stick_topic,
  }))
}

/**
 * Get a single chat by ID with details
 */
export async function getChatById(
  chatId: string,
  userId: string
): Promise<StickChatWithDetails | null> {
  const query = `
    SELECT
      sc.*,
      u.id as owner_user_id,
      u.username as owner_username,
      u.email as owner_email,
      u.full_name as owner_full_name,
      u.avatar_url as owner_avatar_url,
      COALESCE(ps.topic, ss.topic) as stick_topic
    FROM stick_chats sc
    LEFT JOIN users u ON sc.owner_id = u.id
    LEFT JOIN personal_sticks ps ON sc.stick_id = ps.id AND sc.stick_type = 'personal'
    LEFT JOIN social_sticks ss ON sc.stick_id = ss.id AND sc.stick_type = 'social'
    WHERE sc.id = $1
    AND (
      sc.owner_id = $2
      OR EXISTS (SELECT 1 FROM stick_chat_members WHERE chat_id = sc.id AND user_id = $2)
    )
  `

  const row = await queryOne<any>(query, [chatId, userId])
  if (!row) return null

  // Get members
  const members = await getChatMembers(chatId)

  return {
    id: row.id,
    name: row.name,
    stick_id: row.stick_id,
    stick_type: row.stick_type,
    owner_id: row.owner_id,
    org_id: row.org_id,
    is_group: row.is_group,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    chat_type: row.chat_type || "chat",
    visibility: row.visibility || "private",
    description: row.description || null,
    category_id: row.category_id || null,
    topic: row.topic || null,
    sort_order: row.sort_order || 0,
    is_archived: row.is_archived || false,
    livekit_room_name: row.livekit_room_name || null,
    voice_active_participants: row.voice_active_participants || 0,
    owner: row.owner_user_id
      ? {
          id: row.owner_user_id,
          username: row.owner_username,
          email: row.owner_email,
          full_name: row.owner_full_name,
          avatar_url: row.owner_avatar_url,
        }
      : undefined,
    members,
    stick_topic: row.stick_topic,
  }
}

/**
 * Find existing chat for a stick
 */
export async function findChatForStick(
  stickId: string,
  stickType: StickType,
  userId: string
): Promise<StickChat | null> {
  return queryOne<StickChatRow>(
    `SELECT sc.* FROM stick_chats sc
     LEFT JOIN stick_chat_members scm ON sc.id = scm.chat_id
     WHERE sc.stick_id = $1
     AND sc.stick_type = $2
     AND (sc.owner_id = $3 OR scm.user_id = $3)
     AND sc.expires_at > NOW()
     LIMIT 1`,
    [stickId, stickType, userId]
  )
}

/**
 * Find an existing chat by name for a user
 * Used to prevent duplicate chats with the same name
 */
export async function findChatByName(
  name: string,
  userId: string,
  orgId: string | null
): Promise<StickChat | null> {
  const params: (string | null)[] = [name.toLowerCase(), userId]
  let orgCondition = ""

  if (orgId) {
    orgCondition = "AND sc.org_id = $3"
    params.push(orgId)
  }

  return queryOne<StickChatRow>(
    `SELECT sc.* FROM stick_chats sc
     LEFT JOIN stick_chat_members scm ON sc.id = scm.chat_id
     WHERE LOWER(sc.name) = $1
     AND (sc.owner_id = $2 OR scm.user_id = $2)
     ${orgCondition}
     AND sc.expires_at > NOW()
     LIMIT 1`,
    params
  )
}

/**
 * Create a new chat
 */
export async function createChat(data: {
  name?: string
  stick_id?: string
  stick_type?: StickType
  owner_id: string
  org_id?: string
  is_group?: boolean
}): Promise<StickChat | null> {
  const query = `
    INSERT INTO stick_chats (name, stick_id, stick_type, owner_id, org_id, is_group)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `
  const result = await queryOne<StickChatRow>(query, [
    data.name || null,
    data.stick_id || null,
    data.stick_type || null,
    data.owner_id,
    data.org_id || null,
    data.is_group || false,
  ])

  // Add owner as a member
  if (result) {
    await addChatMember(result.id, data.owner_id)
  }

  return result
}

/**
 * Update a chat
 */
export async function updateChat(
  chatId: string,
  userId: string,
  updates: { name?: string; extend_expiry_days?: number }
): Promise<StickChat | null> {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`)
    values.push(updates.name)
    paramIndex++
  }

  if (updates.extend_expiry_days) {
    fields.push(`expires_at = expires_at + INTERVAL '${updates.extend_expiry_days} days'`)
  }

  if (fields.length === 0) return null

  values.push(chatId, userId)
  return queryOne<StickChatRow>(
    `UPDATE stick_chats
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${paramIndex} AND owner_id = $${paramIndex + 1}
     RETURNING *`,
    values
  )
}

/**
 * Delete a chat (owner only)
 */
export async function deleteChat(chatId: string, userId: string): Promise<number> {
  return execute(
    "DELETE FROM stick_chats WHERE id = $1 AND owner_id = $2",
    [chatId, userId]
  )
}

/**
 * Delete expired chats (for cron job)
 */
export async function deleteExpiredChats(): Promise<number> {
  return execute("DELETE FROM stick_chats WHERE expires_at < NOW()")
}

// ==================== CHAT MEMBERS ====================

/**
 * Get all members of a chat
 */
export async function getChatMembers(chatId: string): Promise<StickChatMemberWithUser[]> {
  const query = `
    SELECT
      scm.*,
      u.id as user_id,
      u.username,
      u.email,
      u.full_name,
      u.avatar_url
    FROM stick_chat_members scm
    LEFT JOIN users u ON scm.user_id = u.id
    WHERE scm.chat_id = $1
    ORDER BY scm.joined_at ASC
  `

  const rows = await queryMany<any>(query, [chatId])
  return rows.map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    user_id: row.user_id,
    joined_at: row.joined_at,
    last_read_at: row.last_read_at,
    role: row.role || "member",
    user: {
      id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
  }))
}

/**
 * Add a member to a chat
 */
export async function addChatMember(chatId: string, userId: string): Promise<StickChatMember | null> {
  return queryOne<StickChatMember>(
    `INSERT INTO stick_chat_members (chat_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (chat_id, user_id) DO NOTHING
     RETURNING *`,
    [chatId, userId]
  )
}

/**
 * Remove a member from a chat
 */
export async function removeChatMember(
  chatId: string,
  userId: string,
  requesterId: string
): Promise<number> {
  // Check if requester is owner or removing themselves
  const chat = await queryOne<StickChatRow>(
    "SELECT * FROM stick_chats WHERE id = $1",
    [chatId]
  )

  if (!chat) return 0
  if (chat.owner_id !== requesterId && userId !== requesterId) return 0

  return execute(
    "DELETE FROM stick_chat_members WHERE chat_id = $1 AND user_id = $2",
    [chatId, userId]
  )
}

/**
 * Update last_read_at for a member
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  await execute(
    `UPDATE stick_chat_members
     SET last_read_at = NOW()
     WHERE chat_id = $1 AND user_id = $2`,
    [chatId, userId]
  )
}

/**
 * Check if user is member of chat
 */
export async function isChatMember(chatId: string, userId: string): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM stick_chat_members WHERE chat_id = $1 AND user_id = $2
    ) OR EXISTS(
      SELECT 1 FROM stick_chats WHERE id = $1 AND owner_id = $2
    ) as exists`,
    [chatId, userId]
  )
  return result?.exists || false
}

// ==================== CHAT MESSAGES ====================

/**
 * Get messages for a chat with pagination
 */
export async function getChatMessages(
  chatId: string,
  options?: { limit?: number; cursor?: string; currentUserId?: string }
): Promise<{ messages: StickChatMessageWithUser[]; hasMore: boolean }> {
  const { limit = 50, cursor } = options || {}

  let query = `
    SELECT
      m.*,
      u.id as user_id,
      u.username,
      u.email,
      u.full_name,
      u.avatar_url
    FROM stick_chat_messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.chat_id = $1
  `
  const params: any[] = [chatId]

  if (cursor) {
    query += ` AND m.created_at < $2`
    params.push(cursor)
  }

  query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`
  params.push(limit + 1) // Fetch one extra to check hasMore

  const rows = await queryMany<any>(query, params)
  const hasMore = rows.length > limit
  const messageRows = rows.slice(0, limit)

  // Get reactions for these messages
  const messageIds = messageRows.map((r) => r.id)
  const reactionsMap = await getMessageReactions(messageIds, options?.currentUserId || "")

  const messages: StickChatMessageWithUser[] = messageRows.map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    parent_message_id: row.parent_message_id || null,
    thread_reply_count: row.thread_reply_count || 0,
    thread_last_reply_at: row.thread_last_reply_at || null,
    is_edited: row.is_edited || false,
    edit_history: row.edit_history || [],
    forwarded_from_id: row.forwarded_from_id || null,
    quoted_message_id: row.quoted_message_id || null,
    message_type: row.message_type || "text",
    metadata: row.metadata || {},
    user: {
      id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
    reactions: reactionsMap.get(row.id) || [],
  }))

  // Reverse to get chronological order
  messages.reverse()

  return { messages, hasMore }
}

/**
 * Send a message to a chat
 */
export async function sendMessage(
  chatId: string,
  userId: string,
  content: string,
  options?: {
    parent_message_id?: string
    quoted_message_id?: string
    message_type?: MessageType
    metadata?: Record<string, unknown>
  }
): Promise<StickChatMessageWithUser | null> {
  const query = `
    INSERT INTO stick_chat_messages (chat_id, user_id, content, parent_message_id, quoted_message_id, message_type, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING *
  `
  const result = await queryOne<StickChatMessage>(query, [
    chatId,
    userId,
    content,
    options?.parent_message_id || null,
    options?.quoted_message_id || null,
    options?.message_type || "text",
    JSON.stringify(options?.metadata || {}),
  ])
  if (!result) return null

  const user = await queryOne<any>(
    `SELECT id, username, email, full_name, avatar_url FROM users WHERE id = $1`,
    [userId]
  )

  // Resolve quoted message if present
  let quoted_message: StickChatMessageWithUser["quoted_message"] = null
  if (result.quoted_message_id) {
    const qm = await queryOne<any>(
      `SELECT m.id, m.content, u.id as uid, u.full_name, u.username
       FROM stick_chat_messages m LEFT JOIN users u ON m.user_id = u.id
       WHERE m.id = $1`,
      [result.quoted_message_id]
    )
    if (qm) {
      quoted_message = { id: qm.id, content: qm.content, user: { id: qm.uid, full_name: qm.full_name, username: qm.username } }
    }
  }

  return {
    ...result,
    user: user ? { id: user.id, username: user.username, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url } : undefined,
    quoted_message,
  }
}

/**
 * Get all messages for export (no pagination)
 */
export async function getAllChatMessages(chatId: string): Promise<StickChatMessageWithUser[]> {
  const query = `
    SELECT
      m.*,
      u.id as user_id,
      u.username,
      u.email,
      u.full_name,
      u.avatar_url
    FROM stick_chat_messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.chat_id = $1
    ORDER BY m.created_at ASC
  `

  const rows = await queryMany<any>(query, [chatId])
  return rows.map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    parent_message_id: row.parent_message_id || null,
    thread_reply_count: row.thread_reply_count || 0,
    thread_last_reply_at: row.thread_last_reply_at || null,
    is_edited: row.is_edited || false,
    edit_history: row.edit_history || [],
    forwarded_from_id: row.forwarded_from_id || null,
    quoted_message_id: row.quoted_message_id || null,
    message_type: row.message_type || "text",
    metadata: row.metadata || {},
    user: {
      id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
  }))
}

/**
 * Get unread count for a user across all their chats
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM stick_chat_messages m
     JOIN stick_chat_members scm ON m.chat_id = scm.chat_id
     WHERE scm.user_id = $1
     AND m.created_at > COALESCE(scm.last_read_at, '1970-01-01'::timestamp)
     AND m.user_id != $1`,
    [userId]
  )
  return parseInt(result?.count || "0", 10)
}

/**
 * Get all member user IDs for a chat (for WebSocket broadcasting)
 */
export async function getChatMemberUserIds(chatId: string): Promise<string[]> {
  const rows = await queryMany<{ user_id: string }>(
    `SELECT user_id FROM stick_chat_members WHERE chat_id = $1
     UNION
     SELECT owner_id FROM stick_chats WHERE id = $1`,
    [chatId]
  )
  return rows.map((r) => r.user_id)
}

// ==================== MESSAGE EDITING ====================

/**
 * Edit a message (only by the original author)
 */
export async function editMessage(
  messageId: string,
  userId: string,
  newContent: string
): Promise<StickChatMessageWithUser | null> {
  // Get current message to save in edit history
  const current = await queryOne<any>(
    `SELECT * FROM stick_chat_messages WHERE id = $1 AND user_id = $2`,
    [messageId, userId]
  )
  if (!current) return null

  const editHistory = Array.isArray(current.edit_history) ? current.edit_history : []
  editHistory.push({ content: current.content, edited_at: new Date().toISOString() })

  const updated = await queryOne<StickChatMessage>(
    `UPDATE stick_chat_messages
     SET content = $1, is_edited = true, edit_history = $2::jsonb, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [newContent, JSON.stringify(editHistory), messageId, userId]
  )
  if (!updated) return null

  const user = await queryOne<any>(
    `SELECT id, username, email, full_name, avatar_url FROM users WHERE id = $1`,
    [userId]
  )

  return {
    ...updated,
    user: user ? { id: user.id, username: user.username, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url } : undefined,
  }
}

// ==================== CHANNELS ====================

/**
 * Get all channels for an org (grouped by category)
 */
export async function getOrgChannels(
  orgId: string,
  userId: string,
  filters?: { include_archived?: boolean; chat_type?: ChatType }
): Promise<StickChatWithDetails[]> {
  const params: any[] = [orgId, userId]
  let conditions = `sc.org_id = $1 AND sc.chat_type IN ('channel', 'voice')`

  if (!filters?.include_archived) {
    conditions += ` AND sc.is_archived = false`
  }
  if (filters?.chat_type) {
    params.push(filters.chat_type)
    conditions += ` AND sc.chat_type = $${params.length}`
  }

  const query = `
    SELECT
      sc.*,
      u.id as owner_user_id,
      u.username as owner_username,
      u.email as owner_email,
      u.full_name as owner_full_name,
      (SELECT COUNT(*) FROM stick_chat_members WHERE chat_id = sc.id)::int as member_count,
      (
        SELECT content FROM stick_chat_messages
        WHERE chat_id = sc.id ORDER BY created_at DESC LIMIT 1
      ) as last_message_content,
      (
        SELECT created_at FROM stick_chat_messages
        WHERE chat_id = sc.id ORDER BY created_at DESC LIMIT 1
      ) as last_message_at,
      (
        SELECT COUNT(*) FROM stick_chat_messages
        WHERE chat_id = sc.id
        AND created_at > COALESCE(
          (SELECT last_read_at FROM stick_chat_members WHERE chat_id = sc.id AND user_id = $2),
          '1970-01-01'::timestamp
        )
      )::int as unread_count,
      EXISTS(SELECT 1 FROM stick_chat_members WHERE chat_id = sc.id AND user_id = $2) as is_member
    FROM stick_chats sc
    LEFT JOIN users u ON sc.owner_id = u.id
    WHERE ${conditions}
    AND (
      sc.visibility = 'public'
      OR EXISTS(SELECT 1 FROM stick_chat_members WHERE chat_id = sc.id AND user_id = $2)
      OR sc.owner_id = $2
    )
    ORDER BY sc.sort_order ASC, sc.name ASC
  `

  const rows = await queryMany<any>(query, params)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    stick_id: row.stick_id,
    stick_type: row.stick_type,
    owner_id: row.owner_id,
    org_id: row.org_id,
    is_group: row.is_group,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    chat_type: row.chat_type,
    visibility: row.visibility,
    description: row.description,
    category_id: row.category_id,
    topic: row.topic,
    sort_order: row.sort_order,
    is_archived: row.is_archived,
    livekit_room_name: row.livekit_room_name,
    voice_active_participants: row.voice_active_participants,
    owner: row.owner_user_id ? {
      id: row.owner_user_id,
      username: row.owner_username,
      email: row.owner_email,
      full_name: row.owner_full_name,
    } : undefined,
    last_message: row.last_message_content ? {
      id: "", chat_id: row.id, user_id: "",
      content: row.last_message_content,
      created_at: row.last_message_at,
      updated_at: row.last_message_at,
      parent_message_id: null, thread_reply_count: 0, thread_last_reply_at: null,
      is_edited: false, edit_history: [], forwarded_from_id: null,
      quoted_message_id: null, message_type: "text" as const, metadata: {},
    } : undefined,
    unread_count: row.unread_count || 0,
    member_count: row.member_count || 0,
  }))
}

/**
 * Create a channel
 */
export async function createChannel(data: {
  name: string
  owner_id: string
  org_id: string
  chat_type?: ChatType
  visibility?: ChatVisibility
  description?: string
  category_id?: string
  topic?: string
}): Promise<StickChat | null> {
  const result = await queryOne<StickChatRow>(
    `INSERT INTO stick_chats (name, owner_id, org_id, is_group, chat_type, visibility, description, category_id, topic, expires_at)
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, '9999-12-31'::timestamptz)
     RETURNING *`,
    [
      data.name,
      data.owner_id,
      data.org_id,
      data.chat_type || "channel",
      data.visibility || "public",
      data.description || null,
      data.category_id || null,
      data.topic || null,
    ]
  )

  if (result) {
    await addChatMember(result.id, data.owner_id)
    // Set the creator as admin
    await execute(
      `UPDATE stick_chat_members SET role = 'admin' WHERE chat_id = $1 AND user_id = $2`,
      [result.id, data.owner_id]
    )
  }

  return result
}

// ==================== CHANNEL CATEGORIES ====================

/**
 * Get categories for an org
 */
export async function getChannelCategories(orgId: string): Promise<ChannelCategory[]> {
  const rows = await queryMany<any>(
    `SELECT * FROM channel_categories WHERE org_id = $1 ORDER BY sort_order ASC, name ASC`,
    [orgId]
  )
  return rows.map((row) => ({
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    sort_order: row.sort_order,
    is_collapsed: row.is_collapsed,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
}

/**
 * Create a channel category
 */
export async function createChannelCategory(
  orgId: string,
  name: string,
  createdBy: string,
  sortOrder?: number
): Promise<ChannelCategory | null> {
  return queryOne<any>(
    `INSERT INTO channel_categories (org_id, name, created_by, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orgId, name, createdBy, sortOrder || 0]
  )
}

/**
 * Update a channel category
 */
export async function updateChannelCategory(
  categoryId: string,
  updates: { name?: string; sort_order?: number; is_collapsed?: boolean }
): Promise<ChannelCategory | null> {
  const fields: string[] = []
  const values: any[] = []
  let idx = 1

  if (updates.name !== undefined) { fields.push(`name = $${idx}`); values.push(updates.name); idx++ }
  if (updates.sort_order !== undefined) { fields.push(`sort_order = $${idx}`); values.push(updates.sort_order); idx++ }
  if (updates.is_collapsed !== undefined) { fields.push(`is_collapsed = $${idx}`); values.push(updates.is_collapsed); idx++ }

  if (fields.length === 0) return null

  fields.push(`updated_at = NOW()`)
  values.push(categoryId)

  return queryOne<any>(
    `UPDATE channel_categories SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  )
}

/**
 * Delete a channel category
 */
export async function deleteChannelCategory(categoryId: string): Promise<number> {
  return execute("DELETE FROM channel_categories WHERE id = $1", [categoryId])
}

// ==================== REACTIONS ====================

/**
 * Toggle a reaction on a message (add or remove)
 */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean }> {
  // Check if reaction already exists
  const existing = await queryOne<any>(
    `SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
    [messageId, userId, emoji]
  )

  if (existing) {
    await execute(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    )
    return { added: false }
  }

  await execute(
    `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
    [messageId, userId, emoji]
  )
  return { added: true }
}

/**
 * Get reactions for a set of messages
 */
export async function getMessageReactions(
  messageIds: string[],
  currentUserId: string
): Promise<Map<string, ReactionSummary[]>> {
  if (messageIds.length === 0) return new Map()

  const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(",")
  const rows = await queryMany<any>(
    `SELECT mr.message_id, mr.emoji, mr.user_id, u.full_name, u.username
     FROM message_reactions mr
     LEFT JOIN users u ON mr.user_id = u.id
     WHERE mr.message_id IN (${placeholders})
     ORDER BY mr.created_at ASC`,
    messageIds
  )

  const result = new Map<string, ReactionSummary[]>()

  for (const row of rows) {
    if (!result.has(row.message_id)) {
      result.set(row.message_id, [])
    }
    const reactions = result.get(row.message_id)!
    let summary = reactions.find((r) => r.emoji === row.emoji)
    if (!summary) {
      summary = { emoji: row.emoji, count: 0, users: [], hasReacted: false }
      reactions.push(summary)
    }
    summary.count++
    summary.users.push({ id: row.user_id, full_name: row.full_name, username: row.username })
    if (row.user_id === currentUserId) {
      summary.hasReacted = true
    }
  }

  return result
}

// ==================== THREAD QUERIES ====================

/**
 * Get thread replies for a parent message
 */
export async function getThreadReplies(
  parentMessageId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{ messages: StickChatMessageWithUser[]; hasMore: boolean }> {
  const { limit = 50, cursor } = options || {}
  const params: any[] = [parentMessageId]

  let query = `
    SELECT m.*, u.id as uid, u.username, u.email, u.full_name, u.avatar_url
    FROM stick_chat_messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.parent_message_id = $1
  `

  if (cursor) {
    query += ` AND m.created_at > $2`
    params.push(cursor)
  }

  query += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`
  params.push(limit + 1)

  const rows = await queryMany<any>(query, params)
  const hasMore = rows.length > limit
  const messages = rows.slice(0, limit).map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    parent_message_id: row.parent_message_id,
    thread_reply_count: row.thread_reply_count || 0,
    thread_last_reply_at: row.thread_last_reply_at,
    is_edited: row.is_edited || false,
    edit_history: row.edit_history || [],
    forwarded_from_id: row.forwarded_from_id,
    quoted_message_id: row.quoted_message_id,
    message_type: row.message_type || "text",
    metadata: row.metadata || {},
    user: {
      id: row.uid,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
  }))

  return { messages, hasMore }
}

// ==================== PINNED MESSAGES ====================

/**
 * Pin a message in a chat
 */
export async function pinMessage(chatId: string, messageId: string, pinnedBy: string): Promise<PinnedMessage | null> {
  return queryOne<any>(
    `INSERT INTO pinned_messages (chat_id, message_id, pinned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id, message_id) DO NOTHING
     RETURNING *`,
    [chatId, messageId, pinnedBy]
  )
}

/**
 * Unpin a message
 */
export async function unpinMessage(chatId: string, messageId: string): Promise<number> {
  return execute(
    `DELETE FROM pinned_messages WHERE chat_id = $1 AND message_id = $2`,
    [chatId, messageId]
  )
}

/**
 * Get pinned messages for a chat
 */
export async function getPinnedMessages(chatId: string): Promise<PinnedMessage[]> {
  const rows = await queryMany<any>(
    `SELECT pm.*, m.content, m.user_id as msg_user_id, m.created_at as msg_created_at,
            u.full_name, u.username
     FROM pinned_messages pm
     JOIN stick_chat_messages m ON pm.message_id = m.id
     LEFT JOIN users u ON m.user_id = u.id
     WHERE pm.chat_id = $1
     ORDER BY pm.pinned_at DESC`,
    [chatId]
  )
  return rows.map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    message_id: row.message_id,
    pinned_by: row.pinned_by,
    pinned_at: row.pinned_at,
    message: {
      id: row.message_id,
      chat_id: row.chat_id,
      user_id: row.msg_user_id,
      content: row.content,
      created_at: row.msg_created_at,
      updated_at: row.msg_created_at,
      parent_message_id: null,
      thread_reply_count: 0,
      thread_last_reply_at: null,
      is_edited: false,
      edit_history: [],
      forwarded_from_id: null,
      quoted_message_id: null,
      message_type: "text" as const,
      metadata: {},
      user: { id: row.msg_user_id, full_name: row.full_name, username: row.username },
    },
  }))
}

// ==================== VOICE CHANNEL PARTICIPANTS ====================

/**
 * Join a voice channel
 */
export async function joinVoiceChannel(channelId: string, userId: string): Promise<VoiceParticipant | null> {
  const result = await queryOne<any>(
    `INSERT INTO voice_channel_participants (channel_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (channel_id, user_id) DO UPDATE SET joined_at = NOW()
     RETURNING *`,
    [channelId, userId]
  )
  if (result) {
    await execute(
      `UPDATE stick_chats SET voice_active_participants = (
        SELECT COUNT(*) FROM voice_channel_participants WHERE channel_id = $1
      ) WHERE id = $1`,
      [channelId]
    )
  }
  return result
}

/**
 * Leave a voice channel
 */
export async function leaveVoiceChannel(channelId: string, userId: string): Promise<void> {
  await execute(
    `DELETE FROM voice_channel_participants WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  )
  await execute(
    `UPDATE stick_chats SET voice_active_participants = (
      SELECT COUNT(*) FROM voice_channel_participants WHERE channel_id = $1
    ) WHERE id = $1`,
    [channelId]
  )
}

/**
 * Get voice channel participants
 */
export async function getVoiceParticipants(channelId: string): Promise<VoiceParticipant[]> {
  const rows = await queryMany<any>(
    `SELECT vcp.*, u.username, u.email, u.full_name, u.avatar_url
     FROM voice_channel_participants vcp
     LEFT JOIN users u ON vcp.user_id = u.id
     WHERE vcp.channel_id = $1
     ORDER BY vcp.joined_at ASC`,
    [channelId]
  )
  return rows.map((row) => ({
    id: row.id,
    channel_id: row.channel_id,
    user_id: row.user_id,
    joined_at: row.joined_at,
    is_muted: row.is_muted,
    is_deafened: row.is_deafened,
    user: {
      id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
  }))
}

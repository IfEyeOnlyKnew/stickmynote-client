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
  options?: { limit?: number; cursor?: string }
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
  const messages = rows.slice(0, limit).map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
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
  content: string
): Promise<StickChatMessageWithUser | null> {
  const query = `
    INSERT INTO stick_chat_messages (chat_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING *
  `
  const result = await queryOne<StickChatMessage>(query, [chatId, userId, content])
  if (!result) return null

  // Get user info
  const userQuery = `
    SELECT id, username, email, full_name, avatar_url
    FROM users WHERE id = $1
  `
  const user = await queryOne<any>(userQuery, [userId])

  return {
    ...result,
    user: user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
        }
      : undefined,
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

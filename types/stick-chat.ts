/**
 * Stick Chat Types
 * Types for the chat system - channels, DMs, threads, reactions, voice
 */

export type StickType = "personal" | "social"
export type ChatType = "chat" | "channel" | "voice"
export type ChatVisibility = "public" | "private"
export type MemberRole = "admin" | "member" | "readonly"
export type MessageType = "text" | "system" | "file" | "image"

/**
 * A chat room / channel / voice channel
 */
export interface StickChat {
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
  // Channel fields
  chat_type: ChatType
  visibility: ChatVisibility
  description: string | null
  category_id: string | null
  topic: string | null
  sort_order: number
  is_archived: boolean
  // Voice channel fields
  livekit_room_name: string | null
  voice_active_participants: number
}

/**
 * Chat with additional computed/joined data
 */
export interface StickChatWithDetails extends StickChat {
  owner?: {
    id: string
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
  members?: StickChatMemberWithUser[]
  last_message?: StickChatMessage
  unread_count?: number
  stick_topic?: string // Topic of the attached stick if any
  member_count?: number
}

/**
 * Channel category for sidebar organization
 */
export interface ChannelCategory {
  id: string
  org_id: string
  name: string
  sort_order: number
  is_collapsed: boolean
  created_by: string
  created_at: string
  updated_at: string
  channels?: StickChatWithDetails[]
}

/**
 * A member of a chat room
 */
export interface StickChatMember {
  id: string
  chat_id: string
  user_id: string
  joined_at: string
  last_read_at: string | null
  role: MemberRole
}

/**
 * Chat member with user details
 */
export interface StickChatMemberWithUser extends StickChatMember {
  user?: {
    id: string
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
}

/**
 * A message in a chat room
 */
export interface StickChatMessage {
  id: string
  chat_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  // Threading
  parent_message_id: string | null
  thread_reply_count: number
  thread_last_reply_at: string | null
  // Editing
  is_edited: boolean
  edit_history: Array<{ content: string; edited_at: string }>
  // Forwarding / quoting
  forwarded_from_id: string | null
  quoted_message_id: string | null
  message_type: MessageType
  metadata: Record<string, unknown>
}

/**
 * Message with user details and resolved references
 */
export interface StickChatMessageWithUser extends StickChatMessage {
  user?: {
    id: string
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
  // Resolved quoted message (for display)
  quoted_message?: {
    id: string
    content: string
    user?: {
      id: string
      full_name?: string
      username?: string
    }
  } | null
  // Aggregated reactions on this message
  reactions?: ReactionSummary[]
}

/**
 * Reaction on a message
 */
export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

/**
 * Aggregated reaction summary for display
 */
export interface ReactionSummary {
  emoji: string
  count: number
  users: Array<{ id: string; full_name?: string; username?: string }>
  hasReacted: boolean // Whether current user has this reaction
}

/**
 * Voice channel participant
 */
export interface VoiceParticipant {
  id: string
  channel_id: string
  user_id: string
  joined_at: string
  is_muted: boolean
  is_deafened: boolean
  user?: {
    id: string
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
}

/**
 * Pinned message
 */
export interface PinnedMessage {
  id: string
  chat_id: string
  message_id: string
  pinned_by: string
  pinned_at: string
  message?: StickChatMessageWithUser
}

/**
 * Request body for creating a new chat/channel
 */
export interface CreateStickChatRequest {
  name?: string
  stick_id?: string
  stick_type?: StickType
  is_group?: boolean
  member_ids?: string[]
  // Channel creation
  chat_type?: ChatType
  visibility?: ChatVisibility
  description?: string
  category_id?: string
  topic?: string
}

/**
 * Request body for updating a chat/channel
 */
export interface UpdateStickChatRequest {
  name?: string
  extend_expiry_days?: number
  description?: string
  topic?: string
  visibility?: ChatVisibility
  category_id?: string
  is_archived?: boolean
}

/**
 * Request body for sending a message
 */
export interface SendMessageRequest {
  content: string
  parent_message_id?: string
  quoted_message_id?: string
  message_type?: MessageType
  metadata?: Record<string, unknown>
}

/**
 * Request body for editing a message
 */
export interface EditMessageRequest {
  content: string
}

/**
 * Request body for adding a member
 */
export interface AddMemberRequest {
  user_id?: string
  email?: string
  dn?: string
  full_name?: string
  username?: string
  role?: MemberRole
}

/**
 * Request body for toggling a reaction
 */
export interface ToggleReactionRequest {
  emoji: string
}

/**
 * Request body for creating a channel category
 */
export interface CreateCategoryRequest {
  name: string
  sort_order?: number
}

/**
 * API response for chat list
 */
export interface StickChatsListResponse {
  chats: StickChatWithDetails[]
  total: number
}

/**
 * API response for messages list
 */
export interface StickChatMessagesResponse {
  messages: StickChatMessageWithUser[]
  hasMore: boolean
  cursor?: string
}

/**
 * Filter options for listing chats
 */
export interface StickChatFilters {
  stick_id?: string
  stick_type?: StickType
  is_group?: boolean
  include_expired?: boolean
  chat_type?: ChatType
  visibility?: ChatVisibility
  include_archived?: boolean
}

/**
 * WebSocket event types for real-time chat
 */
export type ChatWsEventType =
  | "chat.message"
  | "chat.message_edited"
  | "chat.message_deleted"
  | "chat.reaction"
  | "chat.typing"
  | "chat.member_joined"
  | "chat.member_left"
  | "chat.thread_reply"
  | "chat.pinned"
  | "chat.unpinned"
  | "voice.joined"
  | "voice.left"
  | "voice.mute_changed"

/**
 * Helper to check if chat is expiring soon (within 7 days)
 */
export function isChatExpiringSoon(chat: StickChat): boolean {
  if (chat.chat_type === "channel") return false // Channels don't expire
  const expiresAt = new Date(chat.expires_at)
  const now = new Date()
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry <= 7 && daysUntilExpiry > 0
}

/**
 * Helper to get days until chat expires
 */
export function getDaysUntilExpiry(chat: StickChat): number {
  const expiresAt = new Date(chat.expires_at)
  const now = new Date()
  return Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Helper to check if chat has expired
 */
export function isChatExpired(chat: StickChat): boolean {
  if (chat.chat_type === "channel") return false
  return new Date(chat.expires_at) < new Date()
}

/**
 * Helper to get display name for a chat
 */
export function getChatDisplayName(chat: StickChatWithDetails, currentUserId?: string): string {
  if (chat.name) return chat.name

  if (chat.stick_topic) return `Chat: ${chat.stick_topic}`

  if (!chat.is_group && chat.members && currentUserId) {
    const otherMember = chat.members.find((m) => m.user_id !== currentUserId)
    if (otherMember?.user) {
      return otherMember.user.full_name || otherMember.user.username || otherMember.user.email || "Direct Message"
    }
  }

  if (chat.chat_type === "voice") return "Voice Channel"
  if (chat.chat_type === "channel") return "Unnamed Channel"
  return chat.is_group ? "Group Chat" : "Direct Message"
}

/**
 * Helper to check if a chat is a persistent channel (no expiry)
 */
export function isChannel(chat: StickChat): boolean {
  return chat.chat_type === "channel" || chat.chat_type === "voice"
}

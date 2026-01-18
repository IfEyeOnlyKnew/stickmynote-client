/**
 * Stick Chat Types
 * Types for the stick chat system - per-stick and standalone chat rooms
 */

export type StickType = "personal" | "social"

/**
 * A chat room - can be standalone or attached to a stick
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
}

/**
 * Message with user details
 */
export interface StickChatMessageWithUser extends StickChatMessage {
  user?: {
    id: string
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
}

/**
 * Request body for creating a new chat
 */
export interface CreateStickChatRequest {
  name?: string
  stick_id?: string
  stick_type?: StickType
  is_group?: boolean
  member_ids?: string[] // Initial members to invite
}

/**
 * Request body for updating a chat
 */
export interface UpdateStickChatRequest {
  name?: string
  extend_expiry_days?: number // Add days to expiry
}

/**
 * Request body for sending a message
 */
export interface SendMessageRequest {
  content: string
}

/**
 * Request body for adding a member
 * Either user_id (for existing users) or email/dn (for LDAP users to auto-provision)
 */
export interface AddMemberRequest {
  user_id?: string
  // For LDAP users who don't have a database account yet
  email?: string
  dn?: string
  full_name?: string
  username?: string
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
}

/**
 * Helper to check if chat is expiring soon (within 7 days)
 */
export function isChatExpiringSoon(chat: StickChat): boolean {
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
  return new Date(chat.expires_at) < new Date()
}

/**
 * Helper to get display name for a chat
 */
export function getChatDisplayName(chat: StickChatWithDetails, currentUserId?: string): string {
  // If chat has a name, use it
  if (chat.name) return chat.name

  // If attached to a stick, use stick topic
  if (chat.stick_topic) return `Chat: ${chat.stick_topic}`

  // For 1-on-1, show the other person's name
  if (!chat.is_group && chat.members && currentUserId) {
    const otherMember = chat.members.find((m) => m.user_id !== currentUserId)
    if (otherMember?.user) {
      return otherMember.user.full_name || otherMember.user.username || otherMember.user.email || "Direct Message"
    }
  }

  // Default
  return chat.is_group ? "Group Chat" : "Direct Message"
}

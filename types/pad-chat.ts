// ============================================================================
// WORLD-CLASS PAD CHAT - TypeScript Types
// ============================================================================

// ----------------------------------------------------------------------------
// Message Types
// ----------------------------------------------------------------------------

export interface PadChatMessage {
  id: string
  social_pad_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string

  // Enhanced features
  is_pinned: boolean
  pinned_by: string | null
  pinned_at: string | null
  is_edited: boolean
  edited_at: string | null
  is_deleted: boolean
  deleted_by: string | null
  reply_to_id: string | null
  is_ai_message: boolean
  is_system_message: boolean
  metadata: Record<string, unknown>

  // Populated relations
  user?: PadChatUser
  reply_to?: PadChatMessage
  reactions?: PadChatReactionSummary[]
  mentions?: string[] // user IDs mentioned
}

export interface PadChatUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_moderator?: boolean
  moderator_status?: ModeratorStatus
}

export interface PadChatReactionSummary {
  emoji: string
  count: number
  users: string[] // user IDs who reacted
  user_reacted: boolean // Did current user react?
}

// ----------------------------------------------------------------------------
// Moderator Types
// ----------------------------------------------------------------------------

export interface PadChatModerator {
  id: string
  social_pad_id: string
  user_id: string
  added_by: string | null
  can_pin: boolean
  can_delete: boolean
  can_mute: boolean
  can_manage_settings: boolean
  is_active: boolean
  is_owner?: boolean // True if this is the pad owner (implicit moderator)
  created_at: string
  updated_at: string

  // Populated relations
  user?: PadChatUser
  added_by_user?: PadChatUser
}

export type ModeratorStatusType = "online" | "away" | "busy" | "offline"

export interface ModeratorStatus {
  user_id: string
  status: ModeratorStatusType
  custom_status: string | null
  auto_away_enabled: boolean
  updated_at: string
}

// ----------------------------------------------------------------------------
// Settings Types
// ----------------------------------------------------------------------------

export type WhoCanChat = "all_members" | "verified" | "moderators_only"
export type EmailDigestFrequency = "hourly" | "daily" | "weekly"
export type ChatTheme = "default" | "dark" | "minimal" | "colorful"

export interface PadChatSettings {
  id: string
  social_pad_id: string

  // General settings
  chat_enabled: boolean
  who_can_chat: WhoCanChat

  // AI First-Responder
  ai_enabled: boolean
  ai_greeting: string
  ai_auto_escalate: boolean

  // Notifications
  notify_moderators_new_message: boolean
  notify_moderators_mentions: boolean
  email_digest_enabled: boolean
  email_digest_frequency: EmailDigestFrequency

  // Office hours
  office_hours_enabled: boolean
  office_hours_timezone: string
  office_hours_start: string // HH:MM format
  office_hours_end: string // HH:MM format
  office_hours_days: number[] // 1=Mon, 7=Sun
  away_message: string

  // UI settings
  chat_theme: ChatTheme
  show_timestamps: boolean
  enable_sounds: boolean
  enable_typing_indicator: boolean

  created_at: string
  updated_at: string
}

export const DEFAULT_CHAT_SETTINGS: Omit<PadChatSettings, "id" | "social_pad_id" | "created_at" | "updated_at"> = {
  chat_enabled: true,
  who_can_chat: "all_members",
  ai_enabled: false,
  ai_greeting: "Hello! How can I help you today?",
  ai_auto_escalate: true,
  notify_moderators_new_message: true,
  notify_moderators_mentions: true,
  email_digest_enabled: false,
  email_digest_frequency: "daily",
  office_hours_enabled: false,
  office_hours_timezone: "UTC",
  office_hours_start: "09:00",
  office_hours_end: "17:00",
  office_hours_days: [1, 2, 3, 4, 5], // Mon-Fri
  away_message: "Our team is currently offline. We'll respond as soon as we're back!",
  chat_theme: "default",
  show_timestamps: true,
  enable_sounds: true,
  enable_typing_indicator: true,
}

// ----------------------------------------------------------------------------
// Typing Indicator
// ----------------------------------------------------------------------------

export interface TypingUser {
  user_id: string
  user?: PadChatUser
  started_at: string
}

// ----------------------------------------------------------------------------
// Muted Users
// ----------------------------------------------------------------------------

export interface MutedUser {
  id: string
  social_pad_id: string
  user_id: string
  muted_by: string
  reason: string | null
  muted_until: string | null // NULL = permanent
  created_at: string

  user?: PadChatUser
  muted_by_user?: PadChatUser
}

// ----------------------------------------------------------------------------
// Read Status
// ----------------------------------------------------------------------------

export interface ChatReadStatus {
  social_pad_id: string
  user_id: string
  last_read_message_id: string | null
  last_read_at: string
  unread_count: number
}

// ----------------------------------------------------------------------------
// Reactions
// ----------------------------------------------------------------------------

export const AVAILABLE_REACTIONS = ["👍", "❤️", "😊", "🎉", "🤔", "👀", "🔥", "💯"] as const
export type ReactionEmoji = (typeof AVAILABLE_REACTIONS)[number]

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: ReactionEmoji
  created_at: string
}

// ----------------------------------------------------------------------------
// Mentions
// ----------------------------------------------------------------------------

export interface MessageMention {
  id: string
  message_id: string
  mentioned_user_id: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

export interface SendMessageRequest {
  content: string
  reply_to_id?: string
  mentions?: string[] // user IDs to mention
}

export interface SendMessageResponse {
  message: PadChatMessage
}

export interface UpdateMessageRequest {
  content: string
}

export interface ToggleReactionRequest {
  emoji: ReactionEmoji
}

export interface AddModeratorRequest {
  email: string
  permissions?: {
    can_pin?: boolean
    can_delete?: boolean
    can_mute?: boolean
    can_manage_settings?: boolean
  }
}

export interface UpdateSettingsRequest {
  settings: Partial<Omit<PadChatSettings, "id" | "social_pad_id" | "created_at" | "updated_at">>
}

export interface MuteUserRequest {
  user_id: string
  reason?: string
  duration_hours?: number // NULL for permanent
}

export interface UpdateModeratorStatusRequest {
  status: ModeratorStatusType
  custom_status?: string
}

// ----------------------------------------------------------------------------
// Event Types (for real-time updates)
// ----------------------------------------------------------------------------

export type PadChatEventType =
  | "message:new"
  | "message:edit"
  | "message:delete"
  | "message:pin"
  | "message:unpin"
  | "reaction:add"
  | "reaction:remove"
  | "typing:start"
  | "typing:stop"
  | "user:join"
  | "user:leave"
  | "moderator:status"

export interface PadChatEvent {
  type: PadChatEventType
  pad_id: string
  data: unknown
  timestamp: string
}

// ----------------------------------------------------------------------------
// Office Hours Helpers
// ----------------------------------------------------------------------------

export function isWithinOfficeHours(settings: PadChatSettings): boolean {
  if (!settings.office_hours_enabled) return true

  const now = new Date()
  const timezone = settings.office_hours_timezone || "UTC"

  // Get current time in the office timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  })

  const parts = formatter.formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0")
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0")
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "Mon"

  // Convert weekday string to number (1=Mon, 7=Sun)
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  const weekday = weekdayMap[weekdayStr] || 1

  // Check if today is a working day
  if (!settings.office_hours_days.includes(weekday)) return false

  // Parse office hours
  const [startHour, startMin] = settings.office_hours_start.split(":").map(Number)
  const [endHour, endMin] = settings.office_hours_end.split(":").map(Number)

  const currentMinutes = hour * 60 + minute
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

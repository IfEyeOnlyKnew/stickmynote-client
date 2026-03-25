// Recognition & Praise Types

export interface RecognitionValue {
  id: string
  org_id: string
  name: string
  description: string | null
  emoji: string
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Kudos {
  id: string
  org_id: string
  giver_id: string
  message: string
  value_id: string | null
  is_public: boolean
  points: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface KudosRecipient {
  id: string
  kudos_id: string
  user_id: string
  created_at: string
}

export interface KudosReaction {
  id: string
  kudos_id: string
  user_id: string
  reaction_type: string
  created_at: string
}

export interface KudosComment {
  id: string
  kudos_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  // Joined fields
  user_full_name?: string
  user_avatar_url?: string
}

export interface Badge {
  id: string
  org_id: string
  name: string
  description: string | null
  icon: string
  color: string
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond"
  category: string
  criteria_type: "manual" | "kudos_count" | "kudos_given" | "streak" | "custom"
  criteria_threshold: number
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BadgeAward {
  id: string
  badge_id: string
  user_id: string
  org_id: string
  awarded_by: string | null
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Joined fields
  badge?: Badge
  user_full_name?: string
  user_avatar_url?: string
  awarded_by_name?: string
}

export interface RecognitionStreak {
  id: string
  user_id: string
  org_id: string
  streak_type: "giving" | "receiving"
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
}

// Feed item for the recognition wall
export interface RecognitionFeedItem {
  kudos_id: string
  org_id: string
  giver_id: string
  message: string
  points: number
  is_public: boolean
  value_id: string | null
  value_name: string | null
  value_emoji: string | null
  value_color: string | null
  created_at: string
  giver_name: string
  giver_avatar: string | null
  recipients: {
    user_id: string
    full_name: string
    avatar_url: string | null
  }[]
  reaction_count: number
  comment_count: number
  // Client-enriched fields
  user_has_reacted?: boolean
  reactions?: KudosReaction[]
  comments?: KudosComment[]
}

// Leaderboard entry
export interface LeaderboardEntry {
  user_id: string
  full_name: string
  avatar_url: string | null
  kudos_received_count: number
  kudos_given_count: number
  total_points: number
  badges_earned_count: number
  rank: number
}

// Recognition settings stored in organization.settings.recognition
export interface RecognitionSettings {
  enabled: boolean
  points_per_kudos: number
  max_kudos_per_day: number
  leaderboard_enabled: boolean
  leaderboard_opt_in: boolean
  manager_notifications: boolean
  allow_self_kudos: boolean
  require_value: boolean
}

export const DEFAULT_RECOGNITION_SETTINGS: RecognitionSettings = {
  enabled: true,
  points_per_kudos: 1,
  max_kudos_per_day: 10,
  leaderboard_enabled: true,
  leaderboard_opt_in: false,
  manager_notifications: true,
  allow_self_kudos: false,
  require_value: false,
}

// Tier colors and display info
export const BADGE_TIERS = {
  bronze: { label: "Bronze", color: "#cd7f32", bgColor: "#fef3e2" },
  silver: { label: "Silver", color: "#c0c0c0", bgColor: "#f5f5f5" },
  gold: { label: "Gold", color: "#ffd700", bgColor: "#fffbeb" },
  platinum: { label: "Platinum", color: "#e5e4e2", bgColor: "#f8f8ff" },
  diamond: { label: "Diamond", color: "#b9f2ff", bgColor: "#f0fdff" },
} as const

// Reaction types available on kudos
export const KUDOS_REACTION_TYPES = [
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "clap", emoji: "👏", label: "Clap" },
  { type: "rocket", emoji: "🚀", label: "Rocket" },
  { type: "star", emoji: "⭐", label: "Star" },
] as const

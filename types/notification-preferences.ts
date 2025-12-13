export type DigestFrequency = "instant" | "hourly" | "daily" | "weekly" | "never"

export interface NotificationPreferences {
  id: string
  user_id: string

  // Channel preferences
  email_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean

  // Frequency preferences
  digest_frequency: DigestFrequency
  digest_time: string // HH:MM:SS format
  digest_day_of_week: number // 0-6, 0 = Sunday

  // Activity type preferences
  stick_created_enabled: boolean
  stick_updated_enabled: boolean
  stick_replied_enabled: boolean
  reaction_enabled: boolean
  member_added_enabled: boolean
  pad_invite_enabled: boolean

  // Pad-specific preferences
  pad_preferences: Record<
    string,
    {
      muted?: boolean
      digest_only?: boolean
    }
  >

  // User-specific preferences
  muted_users: string[]

  created_at: string
  updated_at: string
}

export interface PadNotificationSettings {
  pad_id: string
  pad_name: string
  muted: boolean
  digest_only: boolean
}

export interface DigestQueueItem {
  id: string
  user_id: string
  notification_data: any
  scheduled_for: string
  sent_at: string | null
  created_at: string
}

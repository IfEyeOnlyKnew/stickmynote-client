export type ActivityType =
  | "note_created"
  | "note_updated"
  | "note_shared"
  | "reply_added"
  | "tag_added"
  | "pad_joined"
  | "stick_created"
  | "stick_updated"

export interface Activity {
  id: string
  note_id: string | null
  user_id: string
  activity_type: ActivityType
  metadata: Record<string, any>
  created_at: string
  note_topic?: string
  note_is_shared?: boolean
  user_full_name?: string
  user_email?: string
}

export interface ActivityFeedGroup {
  date: string
  activities: Activity[]
}

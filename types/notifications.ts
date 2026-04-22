export type NotificationType =
  | "reply"
  | "mention"
  | "pad_invite"
  | "pad_update"
  | "reaction"
  | "tag"
  | "kudos_received"
  | "video_call_invite"
export type NotificationRelatedType =
  | "note"
  | "stick"
  | "pad"
  | "reply"
  | "social_stick"
  | "social_pad"
  | "video_room"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  related_type: NotificationRelatedType | null
  action_url: string | null
  read: boolean
  created_at: string
  created_by: string | null
  metadata: Record<string, unknown>
}

export interface NotificationWithUser extends Notification {
  created_by_user?: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
}

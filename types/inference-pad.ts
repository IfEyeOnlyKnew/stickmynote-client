/**
 * Shared types for inference pads, sticks, and members.
 * Used across pad view, edit, listing, and hub pages.
 */

export interface InferencePad {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
  is_public: boolean
  access_mode?: string
  hub_type?: string | null
  hub_email?: string | null
  stick_count?: number
  member_count?: number
  user_role?: string
  social_pad_members?: Array<{ count: number }>
  profiles?: { email: string; full_name: string | null }
}

export interface InferenceStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  created_at: string
  color: string
  is_pinned?: boolean
  pin_order?: number
  pinned_at?: string
  pinned_by?: string
  profiles?: { email: string; full_name: string | null }
  social_stick_replies?: Array<{ count: number }>
  reaction_counts?: Record<string, number>
}

export interface InferencePadMember {
  id: string
  user_id: string
  role: string
  accepted: boolean
  users: {
    id: string
    full_name: string | null
    username: string | null
    email: string
    avatar_url: string | null
  }
}

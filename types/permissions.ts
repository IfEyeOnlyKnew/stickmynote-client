export interface MemberPermissions {
  can_create_sticks: boolean
  can_reply: boolean
  can_edit_others_sticks: boolean
  can_delete_others_sticks: boolean
  can_invite_members: boolean
  can_pin_sticks: boolean
}

export interface PadMember {
  id: string
  social_pad_id: string
  user_id: string
  role: string
  admin_level: string
  accepted: boolean
  invited_at: string
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
  can_create_sticks: boolean
  can_reply: boolean
  can_edit_others_sticks: boolean
  can_delete_others_sticks: boolean
  can_invite_members: boolean
  can_pin_sticks: boolean
  users?: {
    id: string
    full_name: string | null
    username: string | null
    email: string
    avatar_url: string | null
  }
}

export const DEFAULT_PERMISSIONS: Record<string, MemberPermissions> = {
  owner: {
    can_create_sticks: true,
    can_reply: true,
    can_edit_others_sticks: true,
    can_delete_others_sticks: true,
    can_invite_members: true,
    can_pin_sticks: true,
  },
  admin: {
    can_create_sticks: true,
    can_reply: true,
    can_edit_others_sticks: true,
    can_delete_others_sticks: true,
    can_invite_members: true,
    can_pin_sticks: true,
  },
  editor: {
    can_create_sticks: true,
    can_reply: true,
    can_edit_others_sticks: true,
    can_delete_others_sticks: false,
    can_invite_members: false,
    can_pin_sticks: false,
  },
  contributor: {
    can_create_sticks: true,
    can_reply: true,
    can_edit_others_sticks: false,
    can_delete_others_sticks: false,
    can_invite_members: false,
    can_pin_sticks: false,
  },
  viewer: {
    can_create_sticks: false,
    can_reply: true,
    can_edit_others_sticks: false,
    can_delete_others_sticks: false,
    can_invite_members: false,
    can_pin_sticks: false,
  },
}

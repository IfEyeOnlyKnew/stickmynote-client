export interface CalStick {
  id: string
  stick_id: string
  user_id: string
  content: string
  color: string
  calstick_date: string | null
  calstick_completed: boolean
  calstick_completed_at: string | null
  calstick_priority?: string
  calstick_status?: string
  calstick_assignee_id?: string
  calstick_labels?: string[]
  calstick_parent_id?: string
  calstick_estimated_hours?: number
  calstick_actual_hours?: number
  calstick_start_date: string | null
  calstick_start_time?: string | null
  calstick_end_time?: string | null
  calstick_description?: string
  calstick_checklist_items?: any
  calstick_progress?: number
  created_at: string
  updated_at: string
  is_archived?: boolean
  archived_at?: string | null
  archived_by?: string | null
  social_stick_id?: string | null
  user?: {
    id: string
    username: string | null
    full_name: string | null
    email: string
  }
  assignee?: {
    id: string
    username: string | null
    full_name: string | null
    email: string
    avatar_url?: string | null
  }
  stick?: {
    id: string
    topic: string
    content: string
    pad_id: string
    pad: {
      id: string
      name: string
      owner_id: string
    }
  }
}

export interface Dependency {
  id: string
  calstick_id: string
  depends_on_calstick_id: string
  created_at: string
}

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
  // Sprint/Agile fields
  sprint_id?: string | null
  story_points?: number | null
  // Gantt fields
  calstick_is_milestone?: boolean
  baseline_start_date?: string | null
  baseline_end_date?: string | null
  baseline_set_at?: string | null
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
  dependency_type?: 'FS' | 'SS' | 'FF' | 'SF' | 'blocks' | 'relates_to' | 'duplicates'
  lag_days?: number
  created_at: string
}

export interface TimeEntry {
  id: string
  task_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  note: string | null
  is_billable: boolean
  approval_status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  rejection_note: string | null
  created_at: string
  updated_at: string
  // Joined data
  task?: {
    id: string
    content: string
    stick: { id: string; topic: string } | null
  } | null
}

export interface Invoice {
  id: string
  org_id: string | null
  project_id: string | null
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  client_name: string | null
  client_email: string | null
  subtotal_cents: number
  tax_rate: number
  total_cents: number
  notes: string | null
  due_date: string | null
  issued_date: string | null
  paid_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined data
  project?: { id: string; name: string } | null
  line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  time_entry_id: string | null
  description: string | null
  hours: number
  rate_cents: number
  amount_cents: number
  created_at: string
}

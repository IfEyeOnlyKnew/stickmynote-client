export interface LegalHold {
  id: string
  org_id: string
  user_id: string
  hold_name: string
  description?: string | null
  created_by: string
  created_at: string
  released_at?: string | null
  released_by?: string | null
  status: "active" | "released"
  // Joined fields (optional, populated by API)
  user_email?: string
  user_full_name?: string
  created_by_email?: string
  released_by_email?: string
}

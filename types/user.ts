export interface User {
  id: string
  email: string
  username?: string
  full_name?: string
  avatar_url?: string
  bio?: string
  location?: string
  website?: string
  phone?: string
  created_at?: string
  updated_at?: string
  organize_notes?: boolean
  hourly_rate_cents?: number
  capacity_hours_per_day?: number
  hub_mode?: "personal_only" | "full_access"
}

export interface UserProfile extends User {
  // Additional profile fields if needed
}

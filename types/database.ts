export interface AuditLogData {
  operation_type: string
  table_name: string
  record_id: string
  old_values?: Record<string, string | number | boolean | null>
  new_values?: Record<string, string | number | boolean | null>
  user_agent?: string
  ip_address?: string
}

export interface TabData {
  videos?: Array<{
    id: string
    url: string
    title?: string
    description?: string
    duration?: string
    thumbnail?: string
    platform?: "youtube" | "vimeo" | "rumble"
    embed_id?: string
    embed_url?: string
  }>
  images?: Array<{
    id: string
    url: string
    alt?: string
    caption?: string
    size?: number
    width?: number
    height?: number
    format?: string
  }>
  content?: string
  metadata?: Record<string, string | number | boolean>
}

export interface SystemMetricData {
  source: string
  category: string
  details?: Record<string, string | number | boolean>
  timestamp?: string
}

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          operation: string
          table_name: string
          user_id: string
          old_data: AuditLogData | null
          new_data: AuditLogData | null
          user_agent: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          operation: string
          table_name: string
          user_id: string
          old_data?: AuditLogData | null
          new_data?: AuditLogData | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          operation?: string
          table_name?: string
          user_id?: string
          old_data?: AuditLogData | null
          new_data?: AuditLogData | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
      }
      note_tabs: {
        Row: {
          id: string
          note_id: string
          user_id: string
          tab_name: string
          tab_type: string
          tab_content: string
          tab_data: TabData | null
          tab_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          user_id: string
          tab_name: string
          tab_type: string
          tab_content: string
          tab_data?: TabData | null
          tab_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          user_id?: string
          tab_name?: string
          tab_type?: string
          tab_content?: string
          tab_data?: TabData | null
          tab_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          color: string
          position_x: number
          position_y: number
          z_index: number
          topic: string | null
          tags: string[] | null
          images: string[] | null
          videos: string[] | null
          is_shared: boolean
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          color?: string
          position_x?: number
          position_y?: number
          z_index?: number
          topic?: string | null
          tags?: string[] | null
          images?: string[] | null
          videos?: string[] | null
          is_shared?: boolean
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          color?: string
          position_x?: number
          position_y?: number
          z_index?: number
          topic?: string | null
          tags?: string[] | null
          images?: string[] | null
          videos?: string[] | null
          is_shared?: boolean
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      social_stick_tabs: {
        Row: {
          id: string
          social_stick_id: string
          tab_type: string
          title: string | null
          metadata: Record<string, any> | null
          tab_data: TabData | null
          tab_order: number
          thumbnail_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          social_stick_id: string
          tab_type: string
          title?: string | null
          metadata?: Record<string, any> | null
          tab_data?: TabData | null
          tab_order?: number
          thumbnail_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          social_stick_id?: string
          tab_type?: string
          title?: string | null
          metadata?: Record<string, any> | null
          tab_data?: TabData | null
          tab_order?: number
          thumbnail_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          role: "admin" | "editor" | "viewer"
          joined_at: string | null
          invited_at: string | null
          accepted: boolean
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          role?: "admin" | "editor" | "viewer"
          joined_at?: string | null
          invited_at?: string | null
          accepted?: boolean
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          role?: "admin" | "editor" | "viewer"
          joined_at?: string | null
          invited_at?: string | null
          accepted?: boolean
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      team_notes: {
        Row: {
          id: string
          team_id: string
          user_id: string
          topic: string
          content: string
          details: string
          color: string
          position_x: number
          position_y: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          topic?: string
          content?: string
          details?: string
          color?: string
          position_x?: number
          position_y?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          topic?: string
          content?: string
          details?: string
          color?: string
          position_x?: number
          position_y?: number
          created_at?: string
          updated_at?: string
        }
      }
      team_note_replies: {
        Row: {
          id: string
          team_note_id: string
          user_id: string
          content: string
          color: string
          summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_note_id: string
          user_id: string
          content: string
          color?: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_note_id?: string
          user_id?: string
          content?: string
          color?: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      team_note_tabs: {
        Row: {
          id: string
          team_note_id: string
          user_id: string
          tab_name: string
          tab_type: string
          tab_content: string
          tab_data: TabData | null
          tab_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_note_id: string
          user_id: string
          tab_name?: string
          tab_type?: string
          tab_content?: string
          tab_data?: TabData | null
          tab_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_note_id?: string
          user_id?: string
          tab_name?: string
          tab_type?: string
          tab_content?: string
          tab_data?: TabData | null
          tab_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      team_note_tags: {
        Row: {
          id: string
          team_note_id: string
          user_id: string
          tag_title: string
          tag_content: string
          tag_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_note_id: string
          user_id: string
          tag_title: string
          tag_content: string
          tag_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_note_id?: string
          user_id?: string
          tag_title?: string
          tag_content?: string
          tag_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      pending_invites: {
        Row: {
          id: string
          team_id: string
          email: string
          role: "admin" | "editor" | "viewer"
          invited_at: string
          invited_by: string | null
        }
        Insert: {
          id?: string
          team_id: string
          email: string
          role?: "admin" | "editor" | "viewer"
          invited_at?: string
          invited_by?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          email?: string
          role?: "admin" | "editor" | "viewer"
          invited_at?: string
          invited_by?: string | null
        }
      }
      rate_limits: {
        Row: {
          id: string
          user_id: string
          action_type: string
          window_start: string
          count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          window_start: string
          count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          window_start?: string
          count?: number
          created_at?: string
        }
      }
      replies: {
        Row: {
          id: string
          note_id: string
          user_id: string
          content: string
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          user_id: string
          content: string
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          user_id?: string
          content?: string
          color?: string
          created_at?: string
          updated_at?: string
        }
      }
      system_metrics: {
        Row: {
          id: string
          metric_name: string
          metric_value: number
          metric_data: SystemMetricData | null
          recorded_at: string
        }
        Insert: {
          id?: string
          metric_name: string
          metric_value: number
          metric_data?: SystemMetricData | null
          recorded_at?: string
        }
        Update: {
          id?: string
          metric_name?: string
          metric_value?: number
          metric_data?: SystemMetricData | null
          recorded_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          note_id: string
          user_id: string
          tag_title: string
          tag_content: string
          tag_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          user_id: string
          tag_title: string
          tag_content: string
          tag_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          user_id?: string
          tag_title?: string
          tag_content?: string
          tag_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      user: {
        Row: {
          id: string
          email: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          bio: string | null
          phone: string | null
          phone_verified: boolean | null
          email_verified: boolean | null
          created_at: string
          updated_at: string
          createdat: string | null
          updatedat: string | null
        }
        Insert: {
          id: string
          email: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          bio?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          email_verified?: boolean | null
          created_at?: string
          updated_at?: string
          createdat?: string | null
          updatedat?: string | null
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          bio?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          email_verified?: boolean | null
          created_at?: string
          updated_at?: string
          createdat?: string | null
          updatedat?: string | null
        }
      }
      users: {
        Row: {
          id: string
          email: string
          username: string | null
          full_name: string | null
          bio: string | null
          website: string | null
          location: string | null
          organize_notes: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username?: string | null
          full_name?: string | null
          bio?: string | null
          website?: string | null
          location?: string | null
          organize_notes?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          full_name?: string | null
          bio?: string | null
          website?: string | null
          location?: string | null
          organize_notes?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

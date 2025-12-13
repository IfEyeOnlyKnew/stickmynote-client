export interface PadAnalytics {
  pad_id: string
  pad_name: string
  total_sticks: number
  total_replies: number
  total_reactions: number
  total_members: number
  active_members: number
  sticks_this_week: number
  sticks_this_month: number
  most_active_day: string
  engagement_rate: number
  top_contributors: Array<{
    user_id: string
    full_name: string | null
    email: string
    stick_count: number
    reply_count: number
  }>
}

export interface StickAnalytics {
  stick_id: string
  topic: string
  views: number
  replies: number
  reactions: number
  engagement_score: number
  created_at: string
}

export interface UserActivityStats {
  date: string
  sticks_created: number
  replies_added: number
  reactions_given: number
}

// Shared handler logic for stick replies (v1 + v2 deduplication)

export const DEFAULT_REPLY_COLOR = "#fef3c7"

export const REPLY_SELECT_FIELDS = `
  id,
  content,
  color,
  created_at,
  updated_at,
  user_id,
  parent_reply_id,
  is_calstick,
  calstick_date,
  calstick_completed,
  calstick_completed_at
`

export interface ReplyInput {
  content: string
  color?: string
  parent_reply_id?: string | null
  is_calstick?: boolean
  calstick_date?: string | null
  calstick_status?: string | null
  calstick_priority?: string | null
  calstick_parent_id?: string | null
  calstick_assignee_id?: string | null
}

export interface UpdateReplyInput {
  replyId: string
  content: string
  color?: string
}

export interface DeleteReplyInput {
  replyId: string
}

// Parse reply input with defaults
export function parseReplyInput(body: any): ReplyInput & { color: string } {
  return {
    content: body.content,
    color: body.color || DEFAULT_REPLY_COLOR,
    parent_reply_id: body.parent_reply_id ?? null,
    is_calstick: body.is_calstick ?? false,
    calstick_date: body.calstick_date ?? null,
    calstick_status: body.calstick_status ?? null,
    calstick_priority: body.calstick_priority ?? null,
    calstick_parent_id: body.calstick_parent_id ?? null,
    calstick_assignee_id: body.calstick_assignee_id ?? null,
  }
}

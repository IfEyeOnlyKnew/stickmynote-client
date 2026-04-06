/** Depth-based colors for visual distinction of thread levels */
export const DEPTH_COLORS = [
  { line: "border-blue-400", bg: "bg-blue-50", text: "text-blue-600" },
  { line: "border-green-400", bg: "bg-green-50", text: "text-green-600" },
  { line: "border-purple-400", bg: "bg-purple-50", text: "text-purple-600" },
  { line: "border-orange-400", bg: "bg-orange-50", text: "text-orange-600" },
  { line: "border-pink-400", bg: "bg-pink-50", text: "text-pink-600" },
  { line: "border-cyan-400", bg: "bg-cyan-50", text: "text-cyan-600" },
] as const

export type DepthColor = (typeof DEPTH_COLORS)[number]

/** Base reply interface shared across reply components */
export interface BaseReply {
  id: string
  content: string
  color?: string
  created_at: string
  updated_at?: string
  user_id?: string
  user?: {
    username?: string
    email?: string
    full_name?: string
  }
  is_calstick?: boolean
  calstick_date?: string | null
  calstick_completed?: boolean
  calstick_completed_at?: string | null
  parent_reply_id?: string | null
  replies?: BaseReply[]
}

/** Get display name for a reply's user */
export function getReplyDisplayName(reply: BaseReply): string {
  if (!reply.user) return "User"
  return reply.user.full_name || reply.user.username || reply.user.email || "User"
}

/** Get initials for a reply's user */
export function getReplyInitials(reply: BaseReply): string {
  const name = getReplyDisplayName(reply)
  return name.substring(0, 2).toUpperCase()
}

/** Build a tree structure from a flat replies array */
export function buildReplyTree<T extends BaseReply>(replies: T[]): T[] {
  const replyMap = new Map<string, T>()
  const rootReplies: T[] = []

  // First pass: create map with empty replies array
  replies.forEach((reply) => {
    replyMap.set(reply.id, { ...reply, replies: [] })
  })

  // Second pass: build tree by parent_reply_id
  replies.forEach((reply) => {
    const replyWithChildren = replyMap.get(reply.id)!
    if (reply.parent_reply_id && replyMap.has(reply.parent_reply_id)) {
      const parent = replyMap.get(reply.parent_reply_id)!
      parent.replies = parent.replies || []
      parent.replies.push(replyWithChildren as BaseReply)
    } else {
      rootReplies.push(replyWithChildren)
    }
  })

  return rootReplies
}

/** Sort nested replies oldest-first for natural conversation flow */
export function sortNestedReplies<T extends BaseReply>(replies: T[]): void {
  replies.forEach((reply) => {
    if (reply.replies && reply.replies.length > 0) {
      reply.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      sortNestedReplies(reply.replies as T[])
    }
  })
}

/** Count total replies including nested */
export function countAllReplies(replies: BaseReply[]): number {
  let count = 0
  replies.forEach((reply) => {
    count += 1
    if (reply.replies && reply.replies.length > 0) {
      count += countAllReplies(reply.replies)
    }
  })
  return count
}

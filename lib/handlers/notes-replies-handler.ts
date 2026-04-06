// Notes replies handler logic - extracted for v1/v2 deduplication
import { query, querySingle } from '@/lib/database/pg-helpers'

// ============================================================================
// Types
// ============================================================================

export interface RepliesSession {
  user: { id: string; email?: string }
  orgId: string
}

export interface ReplyInput {
  content: string
  color?: string
  parent_reply_id?: string | null
}

export interface ReplyUpdateInput {
  replyId: string
  content?: string
  color?: string
}

interface NoteAccess {
  id: string
  is_shared: boolean
  user_id: string
  org_id: string
}

const DEFAULT_REPLY_COLOR = '#fef3c7'

// ============================================================================
// Data access helpers
// ============================================================================

export async function fetchNoteForReplies(noteId: string): Promise<NoteAccess | null> {
  return querySingle<NoteAccess>(
    `SELECT id, is_shared, user_id, org_id FROM personal_sticks WHERE id = $1`,
    [noteId]
  )
}

export async function fetchReplyById(replyId: string) {
  return querySingle(
    `SELECT id, user_id, org_id, personal_stick_id FROM personal_sticks_replies WHERE id = $1`,
    [replyId]
  )
}

// ============================================================================
// Authorization helpers
// ============================================================================

/**
 * Check if a user can reply to a note.
 * Shared notes: anyone can reply. Private notes: only owner.
 */
export function canReplyToNote(
  note: NoteAccess,
  userId: string,
): { allowed: true } | { allowed: false; reason: string; status: number } {
  if (note.is_shared) return { allowed: true }
  if (note.user_id === userId) return { allowed: true }
  return { allowed: false, reason: 'Cannot reply to private note', status: 403 }
}

/**
 * Check if a user can view replies on a note.
 * Shared notes: anyone. Private notes: only owner.
 */
export function canViewReplies(
  note: NoteAccess,
  userId: string | undefined,
): { allowed: true } | { allowed: false; reason: string; status: number } {
  if (note.is_shared) return { allowed: true }
  if (userId === note.user_id) return { allowed: true }
  return { allowed: false, reason: 'Access denied to private note', status: 403 }
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Get replies for a note, enriched with user data via JOIN.
 */
export async function getRepliesForNote(noteId: string, userId: string | undefined) {
  const note = await fetchNoteForReplies(noteId)
  if (!note) {
    return { status: 200, body: { replies: [] } }
  }

  // Private note access check
  if (!note.is_shared) {
    const access = canViewReplies(note, userId)
    if (!access.allowed) {
      return { status: access.status, body: { error: access.reason } }
    }
  }

  const replies = await query(
    `SELECT r.id, r.content, r.color, r.created_at, r.updated_at, r.user_id, r.view_count, r.parent_reply_id,
            u.id as uid, u.username, u.full_name, u.avatar_url, u.email
     FROM personal_sticks_replies r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.personal_stick_id = $1 AND r.org_id = $2
     ORDER BY r.created_at ASC`,
    [noteId, note.org_id]
  )

  const repliesWithUsers = replies.map((r: any) => ({
    id: r.id,
    content: r.content,
    color: r.color,
    created_at: r.created_at,
    updated_at: r.updated_at,
    user_id: r.user_id,
    view_count: r.view_count || 0,
    parent_reply_id: r.parent_reply_id || null,
    user: {
      id: r.uid || r.user_id,
      username: r.username || r.full_name || r.email?.split('@')[0] || 'User',
      full_name: r.full_name || null,
      avatar_url: r.avatar_url || null,
      email: r.email || null,
    },
  }))

  return { status: 200, body: { replies: repliesWithUsers } }
}

/**
 * Create a reply on a note.
 */
export async function createReplyOnNote(
  noteId: string,
  session: RepliesSession,
  input: ReplyInput,
) {
  const { content, color = DEFAULT_REPLY_COLOR, parent_reply_id = null } = input

  if (!content?.trim()) {
    return { status: 400, body: { error: 'Content is required' } }
  }

  const note = await fetchNoteForReplies(noteId)
  if (!note) {
    return { status: 404, body: { error: 'Note not found' } }
  }

  const authCheck = canReplyToNote(note, session.user.id)
  if (!authCheck.allowed) {
    return { status: authCheck.status, body: { error: authCheck.reason } }
  }

  const reply = await querySingle(
    `INSERT INTO personal_sticks_replies (personal_stick_id, user_id, content, color, org_id, parent_reply_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [noteId, session.user.id, content.trim(), color, session.orgId, parent_reply_id || null]
  )

  if (!reply) {
    return { status: 500, body: { error: 'Failed to create reply' } }
  }

  // Fetch user info for the response
  const userData = await querySingle(
    `SELECT id, username, full_name, avatar_url, email FROM users WHERE id = $1`,
    [session.user.id]
  )

  const completeReply = {
    ...reply,
    view_count: reply.view_count || 0,
    parent_reply_id: reply.parent_reply_id || null,
    user: userData
      ? {
          id: userData.id,
          username: userData.full_name || userData.username || session.user.email?.split('@')[0] || 'User',
          email: userData.email || session.user.email || null,
          full_name: userData.full_name || null,
          avatar_url: userData.avatar_url || null,
        }
      : {
          id: session.user.id,
          username: session.user.email?.split('@')[0] || 'User',
          email: session.user.email || null,
          full_name: null,
          avatar_url: null,
        },
  }

  return {
    status: 200,
    body: { reply: completeReply },
    noteOwnerId: note.user_id !== session.user.id ? note.user_id : null,
    replyId: reply.id,
  }
}

/**
 * Update a reply (only the reply owner can edit).
 */
export async function updateReplyOnNote(session: RepliesSession, input: ReplyUpdateInput) {
  const { replyId, content, color } = input

  if (!replyId) {
    return { status: 400, body: { error: 'Reply ID is required' } }
  }

  const existing = await fetchReplyById(replyId)
  if (!existing) {
    return { status: 404, body: { error: 'Reply not found' } }
  }

  if (existing.user_id !== session.user.id) {
    return { status: 403, body: { error: "Cannot edit another user's reply" } }
  }

  if (existing.org_id !== session.orgId) {
    return { status: 403, body: { error: 'Reply not in your organization' } }
  }

  // Build dynamic update
  const updates = ['updated_at = NOW()']
  const values: any[] = []
  let paramCount = 0

  if (content !== undefined) {
    paramCount++
    updates.push(`content = $${paramCount}`)
    values.push(content.trim())
  }
  if (color !== undefined) {
    paramCount++
    updates.push(`color = $${paramCount}`)
    values.push(color)
  }

  paramCount++
  values.push(replyId)
  paramCount++
  values.push(session.orgId)

  const updated = await querySingle(
    `UPDATE personal_sticks_replies
     SET ${updates.join(', ')}
     WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
     RETURNING *`,
    values
  )

  if (!updated) {
    return { status: 500, body: { error: 'Failed to update reply' } }
  }

  return { status: 200, body: { reply: updated } }
}

/**
 * Delete a reply (reply owner or note owner can delete).
 */
export async function deleteReplyOnNote(session: RepliesSession, replyId: string) {
  if (!replyId) {
    return { status: 400, body: { error: 'Reply ID is required' } }
  }

  const existing = await fetchReplyById(replyId)
  if (!existing) {
    return { status: 404, body: { error: 'Reply not found' } }
  }

  if (existing.org_id !== session.orgId) {
    return { status: 403, body: { error: 'Reply not in your organization' } }
  }

  // Check delete permission: owner of reply OR owner of the note
  if (existing.user_id !== session.user.id) {
    const note = await querySingle(
      `SELECT user_id, org_id FROM personal_sticks WHERE id = $1`,
      [existing.personal_stick_id]
    )

    if (note?.user_id !== session.user.id || note?.org_id !== session.orgId) {
      return { status: 403, body: { error: "Cannot delete another user's reply" } }
    }
  }

  await query(
    `DELETE FROM personal_sticks_replies WHERE id = $1 AND org_id = $2`,
    [replyId, session.orgId]
  )

  return { status: 200, body: { success: true } }
}

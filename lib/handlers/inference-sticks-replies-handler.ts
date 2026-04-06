// Inference Sticks Replies handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'
import { publishToOrg } from '@/lib/ws/publish-event'
import type { OrgContext } from '@/lib/auth/get-org-context'

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedContext {
  user: { id: string; email?: string }
  orgContext: OrgContext
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_REPLY_COLOR = '#fef3c7'
const DEFAULT_CATEGORY = 'Answer'

// ============================================================================
// Shared Helpers
// ============================================================================

async function checkStickAccess(stickId: string, userId: string, orgId: string) {
  const stickResult = await db.query(
    `SELECT ss.social_pad_id, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1 AND ss.org_id = $2`,
    [stickId, orgId]
  )

  if (stickResult.rows.length === 0) {
    return { found: false as const }
  }

  const stick = stickResult.rows[0]

  // Check access
  if (stick.pad_owner_id === userId) {
    return { found: true as const, stick, role: 'owner' as const }
  }

  const memberResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [stick.social_pad_id, userId, orgId]
  )

  if (memberResult.rows.length === 0) {
    return { found: true as const, stick, role: null }
  }

  return { found: true as const, stick, role: memberResult.rows[0].role as string }
}

// ============================================================================
// GET: List replies for a stick
// ============================================================================

export async function listReplies(
  stickId: string,
  orgId: string | undefined
): Promise<{ status: number; body: any }> {
  let query = `SELECT r.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url
               FROM social_stick_replies r
               LEFT JOIN users u ON r.user_id = u.id
               WHERE r.social_stick_id = $1`
  const queryParams: any[] = [stickId]

  if (orgId) {
    query += ` AND r.org_id = $2`
    queryParams.push(orgId)
  }

  query += ` ORDER BY r.created_at DESC`

  const result = await db.query(query, queryParams)

  const replies = result.rows.map((r: any) => ({
    ...r,
    users: {
      id: r.uid || r.user_id,
      full_name: r.full_name,
      username: r.username,
      email: r.email,
      avatar_url: r.avatar_url,
    },
  }))

  return { status: 200, body: { replies } }
}

// ============================================================================
// POST: Create reply
// ============================================================================

export async function createReply(
  stickId: string,
  input: { content: string; color?: string; parent_reply_id?: string; category?: string },
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx
  const { content, color, parent_reply_id, category } = input

  if (!content?.trim()) {
    return { status: 400, body: { error: 'Reply content is required' } }
  }

  // Fetch stick and check access
  const access = await checkStickAccess(stickId, user.id, orgContext.orgId)

  if (!access.found) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  if (access.role === null) {
    return { status: 403, body: { error: 'Access denied' } }
  }

  if (access.role === 'viewer') {
    return { status: 403, body: { error: 'Viewers cannot reply to sticks' } }
  }

  // Insert reply
  const replyResult = await db.query(
    `INSERT INTO social_stick_replies
     (social_stick_id, user_id, content, color, parent_reply_id, category, org_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [stickId, user.id, content.trim(), color || DEFAULT_REPLY_COLOR, parent_reply_id || null, category || DEFAULT_CATEGORY, orgContext.orgId]
  )

  const reply = replyResult.rows[0]

  // Get user data for response
  const userResult = await db.query(
    `SELECT id, full_name, username, email, avatar_url FROM users WHERE id = $1`,
    [user.id]
  )

  // Broadcast real-time events
  publishToOrg(orgContext.orgId, {
    type: 'social_activity.new',
    payload: { stickId, replyId: reply.id, userId: user.id, activityType: 'replied' },
    timestamp: Date.now(),
  })
  publishToOrg(orgContext.orgId, {
    type: 'inference_notification.new',
    payload: { stickId, replyId: reply.id, userId: user.id, type: 'stick_replied' },
    timestamp: Date.now(),
  })

  return {
    status: 200,
    body: { reply: { ...reply, users: userResult.rows[0] || null } },
  }
}

// ============================================================================
// PUT: Update reply
// ============================================================================

export async function updateReply(
  input: { reply_id: string; content: string },
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx
  const { reply_id, content } = input

  if (!reply_id || !content?.trim()) {
    return { status: 400, body: { error: 'Reply ID and content are required' } }
  }

  // Check reply exists and ownership
  const existingResult = await db.query(
    `SELECT user_id FROM social_stick_replies WHERE id = $1 AND org_id = $2`,
    [reply_id, orgContext.orgId]
  )

  if (existingResult.rows.length === 0) {
    return { status: 404, body: { error: 'Reply not found' } }
  }

  if (existingResult.rows[0].user_id !== user.id) {
    return { status: 403, body: { error: 'You can only edit your own replies' } }
  }

  const updateResult = await db.query(
    `UPDATE social_stick_replies
     SET content = $1, updated_at = NOW()
     WHERE id = $2 AND org_id = $3
     RETURNING *`,
    [content.trim(), reply_id, orgContext.orgId]
  )

  return { status: 200, body: { reply: updateResult.rows[0] } }
}

// ============================================================================
// DELETE: Delete reply
// ============================================================================

export async function deleteReply(
  stickId: string,
  replyId: string,
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  if (!replyId) {
    return { status: 400, body: { error: 'Reply ID is required' } }
  }

  // Get stick info for permission check
  const stickResult = await db.query(
    `SELECT ss.social_pad_id, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1 AND ss.org_id = $2`,
    [stickId, orgContext.orgId]
  )

  if (stickResult.rows.length === 0) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  const stick = stickResult.rows[0]

  // Get reply info
  const replyResult = await db.query(
    `SELECT user_id FROM social_stick_replies WHERE id = $1 AND org_id = $2`,
    [replyId, orgContext.orgId]
  )

  if (replyResult.rows.length === 0) {
    return { status: 404, body: { error: 'Reply not found' } }
  }

  // Check delete permission
  const memberResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [stick.social_pad_id, user.id, orgContext.orgId]
  )

  const canDelete =
    replyResult.rows[0].user_id === user.id ||
    stick.pad_owner_id === user.id ||
    memberResult.rows[0]?.role === 'admin'

  if (!canDelete) {
    return { status: 403, body: { error: "You don't have permission to delete this reply" } }
  }

  await db.query(
    `DELETE FROM social_stick_replies WHERE id = $1 AND org_id = $2`,
    [replyId, orgContext.orgId]
  )

  return { status: 200, body: { success: true } }
}

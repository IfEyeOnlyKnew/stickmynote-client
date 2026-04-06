// Inference Sticks [stickId] handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'
import type { OrgContext } from '@/lib/auth/get-org-context'

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedContext {
  user: { id: string; email?: string }
  orgContext: OrgContext
}

// ============================================================================
// Shared Helpers
// ============================================================================

async function checkMembership(padId: string, userId: string, orgId: string) {
  const memberResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [padId, userId, orgId]
  )
  return memberResult.rows[0] || null
}

// ============================================================================
// GET: Fetch stick with details
// ============================================================================

export async function getStickDetail(
  stickId: string,
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  // Fetch stick with pad info
  const stickResult = await db.query(
    `SELECT ss.*, sp.id as pad_id, sp.name as pad_name, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1 AND ss.org_id = $2`,
    [stickId, orgContext.orgId]
  )

  if (stickResult.rows.length === 0) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  const stick = stickResult.rows[0]

  // Check access
  if (stick.pad_owner_id !== user.id) {
    const membership = await checkMembership(stick.social_pad_id, user.id, orgContext.orgId)
    if (!membership) {
      return { status: 403, body: { error: 'Access denied' } }
    }
  }

  // Get details tab
  const detailsResult = await db.query(
    `SELECT tab_data FROM social_stick_tabs
     WHERE social_stick_id = $1 AND tab_type = 'details' AND org_id = $2`,
    [stickId, orgContext.orgId]
  )
  const details = detailsResult.rows[0]?.tab_data?.content || ''

  // Get replies with user info
  const repliesResult = await db.query(
    `SELECT r.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url
     FROM social_stick_replies r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.social_stick_id = $1 AND r.org_id = $2
     ORDER BY r.created_at ASC`,
    [stickId, orgContext.orgId]
  )

  const replies = repliesResult.rows.map((r: any) => ({
    ...r,
    users: {
      id: r.uid || r.user_id,
      full_name: r.full_name,
      username: r.username,
      email: r.email,
      avatar_url: r.avatar_url,
    },
  }))

  return {
    status: 200,
    body: {
      stick: {
        ...stick,
        social_pads: { id: stick.pad_id, name: stick.pad_name, owner_id: stick.pad_owner_id },
        details,
        replies,
      },
    },
  }
}

// ============================================================================
// PATCH: Update stick
// ============================================================================

export async function updateStickDetail(
  stickId: string,
  updates: { topic?: string; content?: string; color?: string },
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  // Fetch stick for access check
  const stickResult = await db.query(
    `SELECT ss.user_id, ss.social_pad_id, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1 AND ss.org_id = $2`,
    [stickId, orgContext.orgId]
  )

  if (stickResult.rows.length === 0) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  const stick = stickResult.rows[0]

  // Check edit permission
  const membership = await checkMembership(stick.social_pad_id, user.id, orgContext.orgId)

  const canEdit =
    stick.user_id === user.id ||
    stick.pad_owner_id === user.id ||
    membership?.role === 'admin' ||
    membership?.role === 'edit'

  if (!canEdit) {
    return { status: 403, body: { error: 'Permission denied' } }
  }

  const updateResult = await db.query(
    `UPDATE social_sticks
     SET topic = COALESCE($1, topic),
         content = COALESCE($2, content),
         color = COALESCE($3, color),
         updated_at = NOW()
     WHERE id = $4 AND org_id = $5
     RETURNING *`,
    [updates.topic, updates.content, updates.color, stickId, orgContext.orgId]
  )

  return { status: 200, body: { stick: updateResult.rows[0] } }
}

// ============================================================================
// DELETE: Delete stick
// ============================================================================

export async function deleteStickDetail(
  stickId: string,
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  // Fetch stick for access check
  const stickResult = await db.query(
    `SELECT ss.user_id, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1 AND ss.org_id = $2`,
    [stickId, orgContext.orgId]
  )

  if (stickResult.rows.length === 0) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  const stick = stickResult.rows[0]

  // Only stick creator or pad owner can delete
  if (stick.user_id !== user.id && stick.pad_owner_id !== user.id) {
    return { status: 403, body: { error: 'Permission denied' } }
  }

  if (await isUnderLegalHold(user.id, orgContext.orgId)) {
    return { status: 403, body: { error: 'Content cannot be deleted: active legal hold' } }
  }

  await db.query(
    `DELETE FROM social_sticks WHERE id = $1 AND org_id = $2`,
    [stickId, orgContext.orgId]
  )

  return { status: 200, body: { success: true } }
}

// Inference Sticks Pin handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Helpers
// ============================================================================

interface StickPinInfo {
  social_pad_id: string
  is_pinned: boolean
  pad_owner_id: string | null
}

/**
 * Get stick with pad owner info for pin operations.
 */
async function getStickForPin(stickId: string, orgId: string): Promise<StickPinInfo | null> {
  const stickResult = await db.query(
    `SELECT ss.social_pad_id, ss.is_pinned, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1 AND ss.org_id = $2`,
    [stickId, orgId]
  )

  if (stickResult.rows.length === 0) {
    return null
  }

  return stickResult.rows[0]
}

/**
 * Check if user can pin/reorder sticks (pad owner or admin).
 */
async function canManagePins(
  socialPadId: string,
  userId: string,
  orgId: string,
  padOwnerId: string | null
): Promise<boolean> {
  if (padOwnerId === userId) return true

  const memberResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [socialPadId, userId, orgId]
  )

  return memberResult.rows[0]?.role === 'admin'
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Toggle pin status for a stick. Returns the updated stick or an error.
 */
export async function togglePin(
  stickId: string,
  userId: string,
  orgId: string
): Promise<{ status: number; body: any }> {
  const stick = await getStickForPin(stickId, orgId)
  if (!stick) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  const canPin = await canManagePins(stick.social_pad_id, userId, orgId, stick.pad_owner_id)
  if (!canPin) {
    return { status: 403, body: { error: 'Only pad owners and admins can pin sticks' } }
  }

  // Get next pin order
  const pinnedResult = await db.query(
    `SELECT COALESCE(MAX(pin_order), 0) as max_order
     FROM social_sticks
     WHERE social_pad_id = $1 AND is_pinned = true AND org_id = $2`,
    [stick.social_pad_id, orgId]
  )
  const nextPinOrder = (pinnedResult.rows[0]?.max_order || 0) + 1

  // Toggle pin
  const newIsPinned = !stick.is_pinned
  const updateResult = await db.query(
    `UPDATE social_sticks
     SET is_pinned = $1,
         pinned_at = $2,
         pinned_by = $3,
         pin_order = $4,
         updated_at = NOW()
     WHERE id = $5 AND org_id = $6
     RETURNING *`,
    [
      newIsPinned,
      newIsPinned ? new Date().toISOString() : null,
      newIsPinned ? userId : null,
      newIsPinned ? nextPinOrder : null,
      stickId,
      orgId,
    ]
  )

  return { status: 200, body: { stick: updateResult.rows[0] } }
}

/**
 * Reorder a pinned stick. Returns the updated stick or an error.
 */
export async function reorderPin(
  stickId: string,
  userId: string,
  orgId: string,
  pinOrder: number
): Promise<{ status: number; body: any }> {
  const stick = await getStickForPin(stickId, orgId)
  if (!stick?.is_pinned) {
    return { status: 404, body: { error: 'Stick not found or not pinned' } }
  }

  const canReorder = await canManagePins(stick.social_pad_id, userId, orgId, stick.pad_owner_id)
  if (!canReorder) {
    return { status: 403, body: { error: 'Only pad owners and admins can reorder pinned sticks' } }
  }

  const updateResult = await db.query(
    `UPDATE social_sticks
     SET pin_order = $1, updated_at = NOW()
     WHERE id = $2 AND org_id = $3
     RETURNING *`,
    [pinOrder, stickId, orgId]
  )

  return { status: 200, body: { stick: updateResult.rows[0] } }
}

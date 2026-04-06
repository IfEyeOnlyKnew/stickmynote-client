// Inference Pads Individual Member handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Constants
// ============================================================================

const VALID_ADMIN_LEVELS = ['owner', 'admin', 'member'] as const

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if the requesting user is the pad owner.
 */
async function checkOwnership(padId: string, userId: string): Promise<boolean> {
  const membershipResult = await db.query(
    `SELECT admin_level FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2`,
    [padId, userId]
  )
  return membershipResult.rows.length > 0 && membershipResult.rows[0].admin_level === 'owner'
}

/**
 * Get a target member's admin level.
 */
async function getTargetMemberLevel(memberId: string): Promise<string | null> {
  const targetResult = await db.query(
    `SELECT admin_level FROM social_pad_members WHERE id = $1`,
    [memberId]
  )
  return targetResult.rows[0]?.admin_level ?? null
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Update a member's admin level. Returns the updated member row or an error.
 */
export async function updateMemberAdminLevel(
  padId: string,
  memberId: string,
  requestingUserId: string,
  adminLevel: string
): Promise<{ status: number; body: any }> {
  const isOwner = await checkOwnership(padId, requestingUserId)
  if (!isOwner) {
    return { status: 403, body: { error: 'Only owners can modify admin permissions' } }
  }

  if (!(VALID_ADMIN_LEVELS as readonly string[]).includes(adminLevel)) {
    return { status: 400, body: { error: 'Invalid admin level' } }
  }

  const targetLevel = await getTargetMemberLevel(memberId)
  if (targetLevel === 'owner' && adminLevel !== 'owner') {
    return { status: 400, body: { error: "Cannot change owner's admin level" } }
  }

  const updateResult = await db.query(
    `UPDATE social_pad_members
     SET admin_level = $1
     WHERE id = $2 AND social_pad_id = $3
     RETURNING *`,
    [adminLevel, memberId, padId]
  )

  return { status: 200, body: { member: updateResult.rows[0] } }
}

/**
 * Remove a member from a pad. Returns success or an error.
 */
export async function removeMember(
  padId: string,
  memberId: string,
  requestingUserId: string
): Promise<{ status: number; body: any }> {
  const isOwner = await checkOwnership(padId, requestingUserId)
  if (!isOwner) {
    return { status: 403, body: { error: 'Only owners can remove members' } }
  }

  const targetLevel = await getTargetMemberLevel(memberId)
  if (targetLevel === 'owner') {
    return { status: 400, body: { error: 'Cannot remove owner' } }
  }

  await db.query(
    `DELETE FROM social_pad_members WHERE id = $1 AND social_pad_id = $2`,
    [memberId, padId]
  )

  return { status: 200, body: { message: 'Member removed successfully' } }
}

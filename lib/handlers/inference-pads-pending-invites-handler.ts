// Inference Pads Pending Invites handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if user can manage pending invites for a pad (owner or admin).
 * Returns { canManage: boolean, padExists: boolean }
 */
export async function checkPadInviteAccess(
  padId: string,
  userId: string,
  orgId: string
): Promise<{ canManage: boolean; padExists: boolean }> {
  const padResult = await db.query(
    `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
    [padId, orgId]
  )

  if (padResult.rows.length === 0) {
    return { canManage: false, padExists: false }
  }

  const membershipResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [padId, userId, orgId]
  )

  const canManage = padResult.rows[0].owner_id === userId || membershipResult.rows[0]?.role === 'admin'
  return { canManage, padExists: true }
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get pending invites for a pad. Returns rows or empty array.
 * Handles case where table doesn't exist yet (returns empty array).
 */
export async function getPendingInvites(padId: string, orgId: string): Promise<any[]> {
  try {
    const invitesResult = await db.query(
      `SELECT * FROM social_pad_pending_invites
       WHERE social_pad_id = $1 AND org_id = $2
       ORDER BY invited_at DESC`,
      [padId, orgId]
    )
    return invitesResult.rows
  } catch (error: any) {
    // Handle case where table doesn't exist
    if (error.code === '42P01') {
      return []
    }
    throw error
  }
}

/**
 * Delete a pending invite.
 */
export async function deletePendingInvite(inviteId: string, padId: string, orgId: string): Promise<void> {
  await db.query(
    `DELETE FROM social_pad_pending_invites
     WHERE id = $1 AND social_pad_id = $2 AND org_id = $3`,
    [inviteId, padId, orgId]
  )
}

// Inference Pads Cleanup Policy handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_POLICY = {
  auto_archive_enabled: false,
  archive_after_days: 90,
  archive_after_replies: null,
  auto_delete_enabled: false,
  delete_archived_after_days: 180,
  max_sticks_per_pad: null,
  max_sticks_per_user: null,
  auto_close_resolved_enabled: false,
  close_resolved_after_days: 7,
  exempt_pinned_sticks: true,
  exempt_workflow_active: true,
}

export const VALID_POLICY_FIELDS = [
  'auto_archive_enabled',
  'archive_after_days',
  'archive_after_replies',
  'auto_delete_enabled',
  'delete_archived_after_days',
  'max_sticks_per_pad',
  'max_sticks_per_user',
  'auto_close_resolved_enabled',
  'close_resolved_after_days',
  'exempt_pinned_sticks',
  'exempt_workflow_active',
] as const

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if user is pad owner or admin.
 */
export async function checkCleanupAccess(
  padId: string,
  userId: string
): Promise<{ padExists: boolean; isOwner: boolean; isAdmin: boolean }> {
  const padResult = await db.query(
    `SELECT owner_id FROM social_pads WHERE id = $1`,
    [padId]
  )

  if (padResult.rows.length === 0) {
    return { padExists: false, isOwner: false, isAdmin: false }
  }

  const isOwner = padResult.rows[0].owner_id === userId

  const membershipResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2`,
    [padId, userId]
  )

  const role = membershipResult.rows[0]?.role
  const isAdmin = role === 'admin' || role === 'owner'

  return { padExists: true, isOwner, isAdmin }
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get the cleanup policy for a pad. Returns default if none exists.
 */
export async function getCleanupPolicy(padId: string): Promise<any> {
  const policyResult = await db.query(
    `SELECT * FROM social_pad_cleanup_policies WHERE social_pad_id = $1`,
    [padId]
  )

  if (policyResult.rows.length === 0) {
    return { social_pad_id: padId, ...DEFAULT_POLICY }
  }

  return policyResult.rows[0]
}

/**
 * Upsert the cleanup policy for a pad.
 */
export async function upsertCleanupPolicy(
  padId: string,
  userId: string,
  body: Record<string, any>
): Promise<any> {
  const updateData: Record<string, any> = {}
  for (const field of VALID_POLICY_FIELDS) {
    if (field in body) {
      updateData[field] = body[field]
    }
  }

  const keys = Object.keys(updateData)
  const values = Object.values(updateData)

  const result = await db.query(
    `INSERT INTO social_pad_cleanup_policies (social_pad_id, created_by, ${keys.join(', ')})
     VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(', ')})
     ON CONFLICT (social_pad_id) DO UPDATE SET
       ${keys.map((k) => `${k} = EXCLUDED.${k}`).join(', ')},
       updated_at = NOW()
     RETURNING *`,
    [padId, userId, ...values]
  )

  return result.rows[0]
}

/**
 * Delete the cleanup policy for a pad.
 */
export async function deleteCleanupPolicy(padId: string): Promise<void> {
  await db.query(
    `DELETE FROM social_pad_cleanup_policies WHERE social_pad_id = $1`,
    [padId]
  )
}

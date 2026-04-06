// Inference Sticks Media handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Add media to a stick. Checks ownership first.
 */
export async function addMedia(
  stickId: string,
  userId: string,
  orgId: string,
  input: { url: string; type: string; filename: string }
): Promise<{ status: number; body: any }> {
  // Check stick ownership
  const stickResult = await db.query(
    `SELECT user_id FROM social_sticks WHERE id = $1 AND org_id = $2`,
    [stickId, orgId]
  )

  if (stickResult.rows.length === 0 || stickResult.rows[0].user_id !== userId) {
    return { status: 403, body: { error: 'Unauthorized' } }
  }

  // Insert media
  const mediaResult = await db.query(
    `INSERT INTO social_stick_media (social_stick_id, url, type, filename, user_id, org_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [stickId, input.url, input.type, input.filename, userId, orgId]
  )

  return { status: 200, body: { success: true, data: mediaResult.rows[0] } }
}

/**
 * Remove media from a stick.
 */
export async function removeMedia(
  stickId: string,
  userId: string,
  orgId: string,
  url: string
): Promise<{ status: number; body: any }> {
  await db.query(
    `DELETE FROM social_stick_media
     WHERE social_stick_id = $1 AND url = $2 AND user_id = $3 AND org_id = $4`,
    [stickId, url, userId, orgId]
  )

  return { status: 200, body: { success: true } }
}

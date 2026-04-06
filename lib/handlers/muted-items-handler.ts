// Muted Items handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get all muted items for a user.
 */
export async function getMutedItems(userId: string): Promise<any[]> {
  const result = await db.query(
    `SELECT * FROM notification_muted_items
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )
  return result.rows
}

/**
 * Mute an item (upsert).
 */
export async function muteItem(
  userId: string,
  input: { entity_type: string; entity_id: string; muted_until?: string | null; reason?: string }
): Promise<any> {
  const result = await db.query(
    `INSERT INTO notification_muted_items (user_id, entity_type, entity_id, muted_until, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, entity_type, entity_id)
     DO UPDATE SET muted_until = EXCLUDED.muted_until, reason = EXCLUDED.reason, updated_at = NOW()
     RETURNING *`,
    [userId, input.entity_type, input.entity_id, input.muted_until || null, input.reason]
  )
  return result.rows[0]
}

/**
 * Unmute an item.
 */
export async function unmuteItem(
  userId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await db.query(
    `DELETE FROM notification_muted_items
     WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [userId, entityType, entityId]
  )
}

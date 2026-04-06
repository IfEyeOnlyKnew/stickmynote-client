// Webhooks Config [webhookId] handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get a single webhook by ID and user.
 */
export async function getWebhookConfig(
  webhookId: string,
  userId: string
): Promise<{ status: number; body: any }> {
  const result = await db.query(
    `SELECT * FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
    [webhookId, userId]
  )

  if (result.rows.length === 0) {
    return { status: 404, body: { error: 'Webhook not found' } }
  }

  return { status: 200, body: { webhook: result.rows[0] } }
}

/**
 * Update a webhook. Strips signing_secret from update data.
 */
export async function updateWebhookConfig(
  webhookId: string,
  userId: string,
  body: Record<string, any>
): Promise<{ status: number; body: any }> {
  const { signing_secret: _, ...updateData } = body

  const updates: string[] = ['updated_at = NOW()']
  const values: any[] = []
  let paramIndex = 1

  const allowedFields = ['name', 'description', 'url', 'headers', 'event_types', 'pad_ids', 'is_active']

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      const value = field === 'headers' ? JSON.stringify(updateData[field]) : updateData[field]
      updates.push(`${field} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  }

  values.push(webhookId, userId)

  const result = await db.query(
    `UPDATE webhook_configurations SET ${updates.join(', ')}
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING *`,
    values
  )

  return { status: 200, body: { webhook: result.rows[0] } }
}

/**
 * Delete a webhook.
 */
export async function deleteWebhookConfig(
  webhookId: string,
  userId: string
): Promise<void> {
  await db.query(
    `DELETE FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
    [webhookId, userId]
  )
}

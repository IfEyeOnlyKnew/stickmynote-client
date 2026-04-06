// Escalation Rules [ruleId] handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_FIELDS = [
  'name', 'description', 'trigger_type', 'trigger_conditions',
  'escalation_channel', 'channel_config', 'cooldown_minutes',
  'max_escalations', 'pad_ids', 'is_active'
] as const

const JSON_FIELDS = new Set(['trigger_conditions', 'channel_config', 'pad_ids'])

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get a single escalation rule by ID and user.
 */
export async function getEscalationRule(
  ruleId: string,
  userId: string
): Promise<{ status: number; body: any }> {
  const result = await db.query(
    `SELECT * FROM notification_escalation_rules
     WHERE id = $1 AND user_id = $2`,
    [ruleId, userId]
  )

  if (result.rows.length === 0) {
    return { status: 404, body: { error: 'Rule not found' } }
  }

  return { status: 200, body: { rule: result.rows[0] } }
}

/**
 * Update an escalation rule.
 */
export async function updateEscalationRule(
  ruleId: string,
  userId: string,
  body: Record<string, any>
): Promise<{ status: number; body: any }> {
  const updates: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      const value = JSON_FIELDS.has(field) ? JSON.stringify(body[field]) : body[field]
      updates.push(`${field} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  }

  if (updates.length === 0) {
    return { status: 400, body: { error: 'No fields to update' } }
  }

  updates.push(`updated_at = NOW()`)

  values.push(ruleId, userId)

  const result = await db.query(
    `UPDATE notification_escalation_rules
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    values
  )

  if (result.rows.length === 0) {
    return { status: 404, body: { error: 'Rule not found' } }
  }

  return { status: 200, body: { rule: result.rows[0] } }
}

/**
 * Delete an escalation rule.
 */
export async function deleteEscalationRule(
  ruleId: string,
  userId: string
): Promise<void> {
  await db.query(
    `DELETE FROM notification_escalation_rules WHERE id = $1 AND user_id = $2`,
    [ruleId, userId]
  )
}

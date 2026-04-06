// Calsticks custom fields handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

export interface CustomFieldsUser {
  id: string
}

// ============================================================================
// GET: Get custom field definitions
// ============================================================================

export async function getCustomFields(user: CustomFieldsUser) {
  const result = await db.query(
    `SELECT * FROM custom_field_definitions WHERE owner_id = $1 ORDER BY created_at ASC`,
    [user.id],
  )
  return { fields: result.rows }
}

// ============================================================================
// POST: Create custom field definition
// ============================================================================

export interface CreateCustomFieldInput {
  name: string
  type: string
  options?: any
  description?: string
  is_required?: boolean
  pad_id?: string
}

export async function createCustomField(user: CustomFieldsUser, input: CreateCustomFieldInput) {
  const { name, type, options, description, is_required, pad_id } = input

  const result = await db.query(
    `INSERT INTO custom_field_definitions (owner_id, name, type, options, description, is_required, pad_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [user.id, name, type, options ? JSON.stringify(options) : null, description, is_required, pad_id || null],
  )

  return { field: result.rows[0] }
}

// ============================================================================
// DELETE: Delete custom field definition
// ============================================================================

export async function deleteCustomField(user: CustomFieldsUser, id: string) {
  if (!id) {
    throw new Error('Missing id')
  }

  await db.query(`DELETE FROM custom_field_definitions WHERE id = $1 AND owner_id = $2`, [
    id,
    user.id,
  ])

  return { success: true }
}

// Sticks handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireId, requireOptionalString } from '@/lib/api/validate'

export interface SticksSession {
  user: { id: string; org_id?: string }
}

export interface CreateStickInput {
  topic: string
  content: string
  color?: string | null
  is_shared?: boolean
}

export interface UpdateStickInput {
  topic?: string | null
  content?: string | null
  color?: string | null
  is_shared?: boolean
}

// List sticks for user/org (owned or shared)
export async function listSticks(session: SticksSession, limit = 50, offset = 0) {
  try {
    const effectiveLimit = Math.min(limit, 100)
    const effectiveOffset = Math.max(offset, 0)
    const sticks = await query(
      `SELECT * FROM sticks WHERE org_id = $1 AND (user_id = $2 OR is_shared = true) ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
      [session.user.org_id, session.user.id, effectiveLimit, effectiveOffset]
    )
    return { status: 200, body: { sticks } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list sticks' } }
  }
}

// Create a stick
export async function createStick(session: SticksSession, input: CreateStickInput) {
  try {
    const topic = requireString(input.topic, 'topic')
    const content = requireString(input.content, 'content')
    const color = requireOptionalString(input.color)
    const is_shared = !!input.is_shared
    const now = new Date().toISOString()
    const stick = await querySingle(
      `INSERT INTO sticks (user_id, org_id, topic, content, color, is_shared, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
      [session.user.id, session.user.org_id, topic, content, color, is_shared, now]
    )
    return { status: 201, body: { stick } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create stick' } }
  }
}

// Update a stick
export async function updateStick(session: SticksSession, stickId: string, input: UpdateStickInput) {
  try {
    const validatedId = requireId(stickId, 'id')
    const topic = requireOptionalString(input.topic)
    const content = requireOptionalString(input.content)
    const color = requireOptionalString(input.color)
    const is_shared = typeof input.is_shared === 'boolean' ? input.is_shared : undefined
    const now = new Date().toISOString()
    const stick = await querySingle(
      `UPDATE sticks SET
        topic = COALESCE($1, topic),
        content = COALESCE($2, content),
        color = COALESCE($3, color),
        is_shared = COALESCE($4, is_shared),
        updated_at = $5
       WHERE id = $6 AND user_id = $7 AND org_id = $8
       RETURNING *`,
      [topic, content, color, is_shared, now, validatedId, session.user.id, session.user.org_id]
    )
    if (!stick) {
      return { status: 404, body: { error: 'Stick not found or not owned by user' } }
    }
    return { status: 200, body: { stick } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to update stick' } }
  }
}

// Delete a stick
export async function deleteStick(session: SticksSession, stickId: string) {
  try {
    const validatedId = requireId(stickId, 'id')
    const deleted = await querySingle(
      'DELETE FROM sticks WHERE id = $1 AND user_id = $2 AND org_id = $3 RETURNING id',
      [validatedId, session.user.id, session.user.org_id]
    )
    if (!deleted) {
      return { status: 404, body: { error: 'Stick not found or not owned by user' } }
    }
    return { status: 200, body: { success: true } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to delete stick' } }
  }
}

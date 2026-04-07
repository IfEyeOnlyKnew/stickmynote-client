// Pads handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireId, requireOptionalString } from '@/lib/api/validate'

export interface PadsSession {
  user: { id: string; org_id?: string }
}

export interface CreatePadInput {
  name: string
  description?: string | null
  is_public?: boolean
}

export interface UpdatePadInput {
  name?: string | null
  description?: string | null
  is_public?: boolean
}

// List pads for user/org (owned or member)
export async function listPads(session: PadsSession, limit = 50, offset = 0) {
  try {
    const effectiveLimit = Math.min(limit, 100)
    const effectiveOffset = Math.max(offset, 0)
    const pads = await query(
      `SELECT * FROM pads WHERE org_id = $1 AND (owner_id = $2 OR $2 = ANY(member_ids)) ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
      [session.user.org_id, session.user.id, effectiveLimit, effectiveOffset]
    )
    return { status: 200, body: { pads } }
  } catch {
    // Expected - database query may fail safely
    return { status: 500, body: { error: 'Failed to list pads' } }
  }
}

// Create a pad
export async function createPad(session: PadsSession, input: CreatePadInput) {
  try {
    const name = requireString(input.name, 'name')
    const description = requireOptionalString(input.description)
    const is_public = !!input.is_public
    const now = new Date().toISOString()
    const pad = await querySingle(
      `INSERT INTO pads (org_id, owner_id, name, description, is_public, created_at, updated_at, member_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $6, ARRAY[$2]) RETURNING *`,
      [session.user.org_id, session.user.id, name, description, is_public, now]
    )
    return { status: 201, body: { pad } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create pad' } }
  }
}

// Update a pad
export async function updatePad(session: PadsSession, padId: string, input: UpdatePadInput) {
  try {
    const validatedId = requireId(padId, 'id')
    const name = requireOptionalString(input.name)
    const description = requireOptionalString(input.description)
    const is_public = typeof input.is_public === 'boolean' ? input.is_public : undefined
    const now = new Date().toISOString()
    const pad = await querySingle(
      `UPDATE pads SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_public = COALESCE($3, is_public),
        updated_at = $4
       WHERE id = $5 AND org_id = $6 AND owner_id = $7
       RETURNING *`,
      [name, description, is_public, now, validatedId, session.user.org_id, session.user.id]
    )
    if (!pad) {
      return { status: 404, body: { error: 'Pad not found or not owned by user' } }
    }
    return { status: 200, body: { pad } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to update pad' } }
  }
}

// Delete a pad
export async function deletePad(session: PadsSession, padId: string) {
  try {
    const validatedId = requireId(padId, 'id')
    const deleted = await querySingle(
      'DELETE FROM pads WHERE id = $1 AND org_id = $2 AND owner_id = $3 RETURNING id',
      [validatedId, session.user.org_id, session.user.id]
    )
    if (!deleted) {
      return { status: 404, body: { error: 'Pad not found or not owned by user' } }
    }
    return { status: 200, body: { success: true } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to delete pad' } }
  }
}

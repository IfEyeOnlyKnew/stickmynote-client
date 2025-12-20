// Multipaks handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface MultipakSession {
  user: { id: string; org_id?: string }
}

export interface CreateMultipakInput {
  name: string
  description?: string | null
}

// List multipaks for user/org
export async function listMultipaks(session: MultipakSession) {
  try {
    const multipaks = await query(
      `SELECT * FROM multipaks WHERE user_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { multipaks } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list multipaks' } }
  }
}

// Create a new multipak
export async function createMultipak(session: MultipakSession, input: CreateMultipakInput) {
  try {
    const name = requireString(input.name, 'name')
    const description = requireOptionalString(input.description)
    const now = new Date().toISOString()
    const multipak = await querySingle(
      `INSERT INTO multipaks (user_id, org_id, name, description, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session.user.id, session.user.org_id, name, description, now]
    )
    return { status: 201, body: { multipak } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create multipak' } }
  }
}

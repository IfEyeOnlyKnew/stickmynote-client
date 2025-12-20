// Quicksticks handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface QuickstickSession {
  user: { id: string; org_id?: string }
}

export interface CreateQuickstickInput {
  name: string
  description?: string | null
}

// List quicksticks for user/org
export async function listQuicksticks(session: QuickstickSession) {
  try {
    const quicksticks = await query(
      `SELECT * FROM quicksticks WHERE user_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { quicksticks } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list quicksticks' } }
  }
}

// Create a new quickstick
export async function createQuickstick(session: QuickstickSession, input: CreateQuickstickInput) {
  try {
    const name = requireString(input.name, 'name')
    const description = requireOptionalString(input.description)
    const now = new Date().toISOString()
    const quickstick = await querySingle(
      `INSERT INTO quicksticks (user_id, org_id, name, description, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session.user.id, session.user.org_id, name, description, now]
    )
    return { status: 201, body: { quickstick } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create quickstick' } }
  }
}

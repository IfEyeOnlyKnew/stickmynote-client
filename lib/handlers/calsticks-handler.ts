// Calsticks handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface CalstickSession {
  user: { id: string; org_id?: string }
}

export interface CreateCalstickInput {
  title: string
  description?: string | null
  start_time: string
  end_time?: string | null
}

export interface UpdateCalstickInput {
  title?: string | null
  description?: string | null
  start_time?: string | null
  end_time?: string | null
}

// List calsticks for user/org
export async function listCalsticks(session: CalstickSession, limit = 50) {
  try {
    const effectiveLimit = Math.min(limit, 100)
    const events = await query(
      `SELECT * FROM calsticks WHERE user_id = $1 AND org_id = $2 ORDER BY start_time DESC LIMIT $3`,
      [session.user.id, session.user.org_id, effectiveLimit]
    )
    return { status: 200, body: { events } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list calsticks' } }
  }
}

// Create a new calstick
export async function createCalstick(session: CalstickSession, input: CreateCalstickInput) {
  try {
    const title = requireString(input.title, 'title')
    const description = requireOptionalString(input.description)
    const startTime = requireString(input.start_time, 'start_time')
    const endTime = requireOptionalString(input.end_time)
    const event = await querySingle(
      `INSERT INTO calsticks (user_id, org_id, title, description, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [session.user.id, session.user.org_id, title, description, startTime, endTime]
    )
    return { status: 201, body: { event } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create calstick' } }
  }
}

// Update a calstick
export async function updateCalstick(session: CalstickSession, eventId: string, input: UpdateCalstickInput) {
  try {
    const title = requireOptionalString(input.title)
    const description = requireOptionalString(input.description)
    const startTime = requireOptionalString(input.start_time)
    const endTime = requireOptionalString(input.end_time)
    const event = await querySingle(
      `UPDATE calsticks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time)
       WHERE id = $5 AND user_id = $6 AND org_id = $7
       RETURNING *`,
      [title, description, startTime, endTime, eventId, session.user.id, session.user.org_id]
    )
    if (!event) {
      return { status: 404, body: { error: 'Event not found or not owned by user' } }
    }
    return { status: 200, body: { event } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to update calstick' } }
  }
}

// Delete a calstick
export async function deleteCalstick(session: CalstickSession, eventId: string) {
  try {
    const deleted = await querySingle(
      'DELETE FROM calsticks WHERE id = $1 AND user_id = $2 AND org_id = $3 RETURNING id',
      [eventId, session.user.id, session.user.org_id]
    )
    if (!deleted) {
      return { status: 404, body: { error: 'Event not found or not owned by user' } }
    }
    return { status: 200, body: { success: true } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to delete calstick' } }
  }
}

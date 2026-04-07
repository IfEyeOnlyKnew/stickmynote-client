// Intake handler logic - extracted for testability
import { querySingle, query } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface IntakeInput {
  name: string
  email: string
  message?: string | null
}

export interface IntakeSession {
  user: { id: string }
}

// List all intake forms
export async function listIntakeForms() {
  try {
    const intakeForms = await query('SELECT * FROM intake_forms ORDER BY submitted_at DESC LIMIT 100')
    return { status: 200, body: { intake: intakeForms } }
  } catch {
    // Expected - database query may fail safely
    return { status: 500, body: { error: 'Failed to list intake forms' } }
  }
}

// Create a new intake form submission
export async function createIntakeForm(session: IntakeSession, input: IntakeInput) {
  try {
    const owner_id = session.user.id
    const name = requireString(input.name, 'name')
    const email = requireString(input.email, 'email')
    const message = requireOptionalString(input.message)
    const now = new Date().toISOString()

    const intake = await querySingle(
      `INSERT INTO intake_forms (owner_id, name, email, message, submitted_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [owner_id, name, email, message, now]
    )
    return { status: 201, body: { intake } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create intake form' } }
  }
}

// Request-access handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface RequestAccessInput {
  name: string
  email: string
  organization?: string | null
  reason?: string | null
}

// List all access requests (admin)
export async function listAccessRequests() {
  try {
    const requests = await query(
      `SELECT * FROM access_requests ORDER BY submitted_at DESC LIMIT 100`
    )
    return { status: 200, body: { 'request-access': requests } }
  } catch {
    // Expected - database query may fail safely
    return { status: 500, body: { error: 'Failed to list access requests' } }
  }
}

// Submit an access request
export async function createAccessRequest(input: RequestAccessInput) {
  try {
    const name = requireString(input.name, 'name')
    const email = requireString(input.email, 'email')
    const org = requireOptionalString(input.organization)
    const reason = requireOptionalString(input.reason)
    const now = new Date().toISOString()
    const requestAccess = await querySingle(
      `INSERT INTO access_requests (name, email, organization, reason, submitted_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, org, reason, now]
    )
    return { status: 201, body: { 'request-access': requestAccess } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create access request' } }
  }
}

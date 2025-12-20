// Analytics handler logic - extracted for testability
import { query } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface AnalyticsSession {
  user: { id: string; org_id?: string }
}

export interface LogAnalyticsInput {
  event: string
  details?: string | null
}

// Log an analytics event
export async function logAnalyticsEvent(session: AnalyticsSession, input: LogAnalyticsInput) {
  try {
    const event = requireString(input.event, 'event')
    const details = requireOptionalString(input.details)
    const now = new Date().toISOString()
    await query(
      `INSERT INTO analytics_events (user_id, org_id, event, details, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.user.id, session.user.org_id, event, details, now]
    )
    return { status: 201, body: { success: true } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to log analytics event' } }
  }
}

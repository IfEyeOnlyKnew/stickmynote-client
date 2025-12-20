// Webhooks handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface WebhookSession {
  user: { id: string; org_id?: string }
}

export interface CreateWebhookInput {
  url: string
  event: string
  description?: string | null
}

// List webhooks for user/org
export async function listWebhooks(session: WebhookSession) {
  try {
    const webhooks = await query(
      `SELECT * FROM webhooks WHERE user_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { webhooks } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list webhooks' } }
  }
}

// Create a new webhook
export async function createWebhook(session: WebhookSession, input: CreateWebhookInput) {
  try {
    const url = requireString(input.url, 'url')
    const event = requireString(input.event, 'event')
    const description = requireOptionalString(input.description)
    const now = new Date().toISOString()
    const webhook = await querySingle(
      `INSERT INTO webhooks (user_id, org_id, url, event, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [session.user.id, session.user.org_id, url, event, description, now]
    )
    return { status: 201, body: { webhook } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create webhook' } }
  }
}

// v2 Webhooks Config API: production-quality, manage webhooks
import { type NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/webhooks/config - Get user's webhooks
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const result = await db.query(
      `SELECT id, name, description, url, event_types, pad_ids, is_active,
              total_deliveries, successful_deliveries, failed_deliveries,
              last_triggered_at, last_success_at, last_failure_at, created_at
       FROM webhook_configurations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    )

    return new Response(JSON.stringify({ webhooks: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/webhooks/config - Create webhook
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const body = await request.json()

    // Generate signing secret
    const signingSecret = crypto.randomBytes(32).toString('hex')

    const result = await db.query(
      `INSERT INTO webhook_configurations (user_id, name, description, url, signing_secret, headers, event_types, pad_ids, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, url, event_types, pad_ids, is_active, signing_secret, created_at`,
      [
        user.id,
        body.name,
        body.description,
        body.url,
        signingSecret,
        JSON.stringify(body.headers || {}),
        body.event_types || [],
        body.pad_ids || [],
        body.is_active ?? true,
      ]
    )

    return new Response(JSON.stringify({ webhook: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

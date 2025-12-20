// v2 Webhooks Replay API: production-quality, replay webhook delivery
import { type NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/webhooks/config/[webhookId]/replay - Replay webhook delivery
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params

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
    const { log_id } = body

    if (!log_id) {
      return new Response(JSON.stringify({ error: 'log_id is required' }), { status: 400 })
    }

    // Get log
    const logResult = await db.query(
      `SELECT * FROM webhook_delivery_logs WHERE id = $1 AND webhook_id = $2`,
      [log_id, webhookId]
    )

    if (logResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Log not found' }), { status: 404 })
    }

    const log = logResult.rows[0]

    // Get webhook
    const webhookResult = await db.query(
      `SELECT * FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
      [webhookId, user.id]
    )

    if (webhookResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), { status: 404 })
    }

    const webhook = webhookResult.rows[0]

    const payloadString = JSON.stringify(log.payload)

    const signature = crypto.createHmac('sha256', webhook.signing_secret).update(payloadString).digest('hex')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString(),
      'X-Webhook-Replay': 'true',
      ...(typeof webhook.headers === 'object' ? webhook.headers : {}),
    }

    const startTime = Date.now()

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
    })

    const responseTime = Date.now() - startTime
    let responseBody: string | null = null

    try {
      responseBody = await response.text()
    } catch {}

    // Update log
    await db.query(
      `UPDATE webhook_delivery_logs SET
        status = $1,
        attempt_count = COALESCE(attempt_count, 0) + 1,
        response_status = $2,
        response_body = $3,
        response_time_ms = $4,
        last_attempted_at = NOW(),
        completed_at = CASE WHEN $5 THEN NOW() ELSE NULL END
       WHERE id = $6`,
      [
        response.ok ? 'success' : 'failed',
        response.status,
        responseBody,
        responseTime,
        response.ok,
        log_id,
      ]
    )

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        response_time_ms: responseTime,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

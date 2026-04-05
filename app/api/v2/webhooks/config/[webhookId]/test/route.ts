// v2 Webhooks Test API: production-quality, test webhook delivery
import { type NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/webhooks/config/[webhookId]/test - Test webhook
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

    // Get webhook
    const webhookResult = await db.query(
      `SELECT * FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
      [webhookId, user.id]
    )

    if (webhookResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), { status: 404 })
    }

    const webhook = webhookResult.rows[0]

    // Create test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from Stick My Note',
        webhook_id: webhookId,
        user_id: user.id,
      },
    }

    const payloadString = JSON.stringify(testPayload)

    // Generate signature
    const signature = crypto.createHmac('sha256', webhook.signing_secret).update(payloadString).digest('hex')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString(),
      ...(typeof webhook.headers === 'object' ? webhook.headers : {}),
    }

    const startTime = Date.now()

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
      })

      const responseTime = Date.now() - startTime
      let responseBody: string | null = null

      try {
        responseBody = await response.text()
      } catch {
        // Response body may be unreadable — log delivery with null body
      }

      // Log the test delivery
      await db.query(
        `INSERT INTO webhook_delivery_logs (webhook_id, event_type, event_id, payload, status, attempt_count, response_status, response_body, response_time_ms, first_attempted_at, last_attempted_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $10)`,
        [
          webhookId,
          'test',
          crypto.randomUUID(),
          JSON.stringify(testPayload),
          response.ok ? 'success' : 'failed',
          1,
          response.status,
          responseBody,
          responseTime,
          new Date().toISOString(),
        ]
      )

      // Update webhook stats
      await db.query(
        `UPDATE webhook_configurations SET
          total_deliveries = COALESCE(total_deliveries, 0) + 1,
          successful_deliveries = COALESCE(successful_deliveries, 0) + $1,
          failed_deliveries = COALESCE(failed_deliveries, 0) + $2,
          last_triggered_at = NOW(),
          last_success_at = CASE WHEN $3 THEN NOW() ELSE last_success_at END,
          last_failure_at = CASE WHEN NOT $3 THEN NOW() ELSE last_failure_at END
         WHERE id = $4`,
        [response.ok ? 1 : 0, response.ok ? 0 : 1, response.ok, webhookId]
      )

      return new Response(
        JSON.stringify({
          success: response.ok,
          status: response.status,
          response_time_ms: responseTime,
          response_body: responseBody,
        }),
        { status: 200 }
      )
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log failed delivery
      await db.query(
        `INSERT INTO webhook_delivery_logs (webhook_id, event_type, event_id, payload, status, attempt_count, error_message, response_time_ms, first_attempted_at, last_attempted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [
          webhookId,
          'test',
          crypto.randomUUID(),
          JSON.stringify(testPayload),
          'failed',
          1,
          errorMessage,
          responseTime,
          new Date().toISOString(),
        ]
      )

      // Update webhook stats
      await db.query(
        `UPDATE webhook_configurations SET
          total_deliveries = COALESCE(total_deliveries, 0) + 1,
          failed_deliveries = COALESCE(failed_deliveries, 0) + 1,
          last_triggered_at = NOW(),
          last_failure_at = NOW()
         WHERE id = $1`,
        [webhookId]
      )

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          response_time_ms: responseTime,
        }),
        { status: 200 }
      )
    }
  } catch (error) {
    return handleApiError(error)
  }
}

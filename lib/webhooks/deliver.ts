import crypto from "node:crypto"

interface WebhookConfig {
  id: string
  url: string
  signing_secret: string
  headers?: Record<string, string>
}

interface WebhookPayload {
  event: string
  timestamp: string
  data: Record<string, unknown>
}

export async function deliverWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload,
): Promise<{
  success: boolean
  status?: number
  responseTime: number
  error?: string
}> {
  const payloadString = JSON.stringify(payload)

  // Generate HMAC-SHA256 signature
  const signature = crypto.createHmac("sha256", webhook.signing_secret).update(payloadString).digest("hex")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": payload.timestamp,
    "X-Webhook-Event": payload.event,
    ...(webhook.headers || {}),
  }

  const startTime = Date.now()

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    return {
      success: response.ok,
      status: response.status,
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export function createWebhookPayload(event: string, data: Record<string, unknown>): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  }
}

// Supported webhook event types
export const WEBHOOK_EVENTS = [
  "stick_created",
  "stick_updated",
  "stick_deleted",
  "stick_resolved",
  "reply_added",
  "reply_deleted",
  "pad_created",
  "pad_updated",
  "pad_deleted",
  "member_added",
  "member_removed",
  "mention",
  "escalation_triggered",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

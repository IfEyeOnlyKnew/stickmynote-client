import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(_request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  const db = await createDatabaseClient()

  const { user, rateLimited } = await getCachedAuthUser()

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: webhook, error: webhookError } = await db
    .from("webhook_configurations")
    .select("*")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (webhookError || !webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  // Create test payload
  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook delivery from Stick My Note",
      webhook_id: webhookId,
      user_id: user.id,
    },
  }

  const payloadString = JSON.stringify(testPayload)

  // Generate signature
  const signature = crypto.createHmac("sha256", webhook.signing_secret).update(payloadString).digest("hex")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": new Date().toISOString(),
    ...(webhook.headers as Record<string, string> | undefined),
  }

  const startTime = Date.now()

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
    })

    const responseTime = Date.now() - startTime
    let responseBody: string | null = null

    try {
      responseBody = await response.text()
    } catch {
      // Ignore response body errors
    }

    // Log the test delivery
    await db.from("webhook_delivery_logs").insert({
      webhook_id: webhookId,
      event_type: "test",
      event_id: crypto.randomUUID(),
      payload: testPayload,
      status: response.ok ? "success" : "failed",
      attempt_count: 1,
      response_status: response.status,
      response_body: responseBody,
      response_time_ms: responseTime,
      first_attempted_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })

    // Update webhook stats
    await db
      .from("webhook_configurations")
      .update({
        total_deliveries: (webhook.total_deliveries || 0) + 1,
        successful_deliveries: response.ok
          ? (webhook.successful_deliveries || 0) + 1
          : webhook.successful_deliveries || 0,
        failed_deliveries: response.ok ? webhook.failed_deliveries || 0 : (webhook.failed_deliveries || 0) + 1,
        last_triggered_at: new Date().toISOString(),
        ...(response.ok
          ? { last_success_at: new Date().toISOString() }
          : { last_failure_at: new Date().toISOString() }),
      })
      .eq("id", webhookId)

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response_time_ms: responseTime,
      response_body: responseBody,
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Log failed delivery
    await db.from("webhook_delivery_logs").insert({
      webhook_id: webhookId,
      event_type: "test",
      event_id: crypto.randomUUID(),
      payload: testPayload,
      status: "failed",
      attempt_count: 1,
      error_message: errorMessage,
      response_time_ms: responseTime,
      first_attempted_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
    })

    // Update webhook stats
    await db
      .from("webhook_configurations")
      .update({
        total_deliveries: (webhook.total_deliveries || 0) + 1,
        failed_deliveries: (webhook.failed_deliveries || 0) + 1,
        last_triggered_at: new Date().toISOString(),
        last_failure_at: new Date().toISOString(),
      })
      .eq("id", webhookId)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      response_time_ms: responseTime,
    })
  }
}

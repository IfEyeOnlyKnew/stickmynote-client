import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  const supabase = await createClient()

  const { user, rateLimited } = await getCachedAuthUser(supabase)

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { log_id } = body

    if (!log_id) {
      return NextResponse.json({ error: "log_id is required" }, { status: 400 })
    }

    const { data: log, error: logError } = await supabase
      .from("webhook_delivery_logs")
      .select("*")
      .eq("id", log_id)
      .eq("webhook_id", webhookId)
      .maybeSingle()

    if (logError || !log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 })
    }

    const { data: webhook, error: webhookError } = await supabase
      .from("webhook_configurations")
      .select("*")
      .eq("id", webhookId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (webhookError || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    const payloadString = JSON.stringify(log.payload)

    const signature = crypto.createHmac("sha256", webhook.signing_secret).update(payloadString).digest("hex")

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Signature": signature,
      "X-Webhook-Timestamp": new Date().toISOString(),
      "X-Webhook-Replay": "true",
      ...((webhook.headers as Record<string, string>) || {}),
    }

    const startTime = Date.now()

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
      // Ignore
    }

    await supabase
      .from("webhook_delivery_logs")
      .update({
        status: response.ok ? "success" : "failed",
        attempt_count: (log.attempt_count || 0) + 1,
        response_status: response.status,
        response_body: responseBody,
        response_time_ms: responseTime,
        last_attempted_at: new Date().toISOString(),
        completed_at: response.ok ? new Date().toISOString() : null,
      })
      .eq("id", log_id)

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response_time_ms: responseTime,
    })
  } catch (error) {
    console.error("Error replaying webhook:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

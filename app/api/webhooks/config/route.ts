import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
  const db = await createDatabaseClient()

  const { user, rateLimited } = await getCachedAuthUser()

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: webhooks, error } = await db
    .from("webhook_configurations")
    .select(
      "id, name, description, url, event_types, pad_ids, is_active, total_deliveries, successful_deliveries, failed_deliveries, last_triggered_at, last_success_at, last_failure_at, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching webhooks:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ webhooks })
}

export async function POST(request: Request) {
  const db = await createDatabaseClient()

  const { user, rateLimited } = await getCachedAuthUser()

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Generate signing secret
    const signingSecret = crypto.randomBytes(32).toString("hex")

    const { data: webhook, error } = await db
      .from("webhook_configurations")
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description,
        url: body.url,
        signing_secret: signingSecret,
        headers: body.headers || {},
        event_types: body.event_types || [],
        pad_ids: body.pad_ids || [],
        is_active: body.is_active ?? true,
      })
      .select("id, name, description, url, event_types, pad_ids, is_active, signing_secret, created_at")
      .maybeSingle()

    if (error) {
      console.error("Error creating webhook:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ webhook })
  } catch (err) {
    console.error("Error parsing request:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

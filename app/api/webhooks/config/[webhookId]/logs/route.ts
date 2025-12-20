import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  const db = await createDatabaseClient()

  const { user, rateLimited } = await getCachedAuthUser()

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: webhook } = await db
    .from("webhook_configurations")
    .select("id")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number.parseInt(searchParams.get("limit") || "50")
  const status = searchParams.get("status")

  let query = db
    .from("webhook_delivery_logs")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq("status", status)
  }

  const { data: logs, error } = await query

  if (error) {
    console.error("Error fetching webhook logs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs })
}

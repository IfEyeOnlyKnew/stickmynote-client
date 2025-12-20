import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(_request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  const db = await createDatabaseClient()

  const { user, rateLimited } = await getCachedAuthUser()

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: webhook, error } = await db
    .from("webhook_configurations")
    .select("*")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !webhook) {
    return NextResponse.json({ error: error?.message || "Webhook not found" }, { status: 404 })
  }

  return NextResponse.json({ webhook })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
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

    // Don't allow updating signing_secret through this endpoint
    const { signing_secret: _, ...updateData } = body

    const { data: webhook, error } = await db
      .from("webhook_configurations")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", webhookId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ webhook })
  } catch (err) {
    console.error("Error updating webhook:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  const db = await createDatabaseClient()

  const { user, rateLimited } = await getCachedAuthUser()

  if (rateLimited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await db.from("webhook_configurations").delete().eq("id", webhookId).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getWebhookConfig, updateWebhookConfig, deleteWebhookConfig } from "@/lib/handlers/webhooks-config-handler"

export async function GET(_request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  try {
    const { webhookId } = await params

    const { user, rateLimited } = await getCachedAuthUser()
    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await getWebhookConfig(webhookId, user.id)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error fetching webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  try {
    const { webhookId } = await params

    const { user, rateLimited } = await getCachedAuthUser()
    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const result = await updateWebhookConfig(webhookId, user.id, body)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    console.error("Error updating webhook:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  try {
    const { webhookId } = await params

    const { user, rateLimited } = await getCachedAuthUser()
    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await deleteWebhookConfig(webhookId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

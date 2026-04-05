import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getOrgChannels,
  createChannel,
  getChannelCategories,
} from "@/lib/database/stick-chat-queries"
import type { CreateStickChatRequest } from "@/types/stick-chat"

/**
 * CHANNELS API
 *
 * GET  /api/channels - List all channels for the org
 * POST /api/channels - Create a new channel
 */

// GET /api/channels
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext(user.id)
    if (!orgContext?.orgId) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const chatType = searchParams.get("chat_type") as "channel" | "voice" | undefined
    const includeArchived = searchParams.get("include_archived") === "true"

    const [channels, categories] = await Promise.all([
      getOrgChannels(orgContext.orgId, user.id, {
        chat_type: chatType || undefined,
        include_archived: includeArchived,
      }),
      getChannelCategories(orgContext.orgId),
    ])

    return NextResponse.json({ channels, categories })
  } catch (error) {
    console.error("[Channels] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/channels
export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext(user.id)
    if (!orgContext?.orgId) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body: CreateStickChatRequest = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 })
    }

    const channel = await createChannel({
      name: body.name.trim(),
      owner_id: user.id,
      org_id: orgContext.orgId,
      chat_type: body.chat_type || "channel",
      visibility: body.visibility || "public",
      description: body.description,
      category_id: body.category_id,
      topic: body.topic,
    })

    if (!channel) {
      return NextResponse.json({ error: "Failed to create channel" }, { status: 500 })
    }

    return NextResponse.json({ channel }, { status: 201 })
  } catch (error) {
    console.error("[Channels] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

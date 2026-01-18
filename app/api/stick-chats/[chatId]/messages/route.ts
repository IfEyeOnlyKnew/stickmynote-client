import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getChatMessages,
  sendMessage,
  isChatMember,
  markChatAsRead,
} from "@/lib/database/stick-chat-queries"
import type { SendMessageRequest } from "@/types/stick-chat"

/**
 * STICK CHAT MESSAGES API
 *
 * Handles listing and sending messages in a chat.
 */

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  notMember: () => NextResponse.json({ error: "You are not a member of this chat" }, { status: 403 }),
  contentRequired: () => NextResponse.json({ error: "Content is required" }, { status: 400 }),
  sendFailed: () => NextResponse.json({ error: "Failed to send message" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Auth Helpers
// ============================================================================

interface OrgContext {
  orgId: string
  organizationId?: string
}

interface RateLimitedResult {
  rateLimited: true
}

function isRateLimited(result: OrgContext | RateLimitedResult | null): result is RateLimitedResult {
  return result !== null && "rateLimited" in result
}

async function safeGetOrgContext(userId: string): Promise<OrgContext | RateLimitedResult | null> {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { rateLimited: true }
    }
    throw error
  }
}

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/stick-chats/[chatId]/messages
 * Get messages for a chat with pagination
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (isRateLimited(orgContextResult)) {
      return createRateLimitResponse()
    }

    // Check membership
    const isMember = await isChatMember(chatId, user.id)
    if (!isMember) {
      return Errors.notMember()
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const cursor = searchParams.get("cursor") || undefined

    const { messages, hasMore } = await getChatMessages(chatId, { limit, cursor })

    // Mark chat as read
    await markChatAsRead(chatId, user.id)

    return NextResponse.json({
      messages,
      hasMore,
      cursor: hasMore && messages.length > 0 ? messages[0].created_at : undefined,
    })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChatMessages] GET error:", error)
    return Errors.internal()
  }
}

/**
 * POST /api/stick-chats/[chatId]/messages
 * Send a message to a chat
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { chatId } = await params
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (isRateLimited(orgContextResult)) {
      return createRateLimitResponse()
    }

    // Check membership
    const isMember = await isChatMember(chatId, user.id)
    if (!isMember) {
      return Errors.notMember()
    }

    const body: SendMessageRequest = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return Errors.contentRequired()
    }

    const message = await sendMessage(chatId, user.id, content.trim())
    if (!message) {
      return Errors.sendFailed()
    }

    // Mark as read since we just sent a message
    await markChatAsRead(chatId, user.id)

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChatMessages] POST error:", error)
    return Errors.internal()
  }
}

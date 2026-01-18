import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getChatById,
  updateChat,
  deleteChat,
  isChatMember,
} from "@/lib/database/stick-chat-queries"
import type { UpdateStickChatRequest } from "@/types/stick-chat"

/**
 * STICK CHAT BY ID API
 *
 * Handles getting, updating, and deleting a specific chat.
 */

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  notFound: () => NextResponse.json({ error: "Chat not found" }, { status: 404 }),
  forbidden: () => NextResponse.json({ error: "You do not have access to this chat" }, { status: 403 }),
  updateFailed: () => NextResponse.json({ error: "Failed to update chat" }, { status: 500 }),
  deleteFailed: () => NextResponse.json({ error: "Failed to delete chat" }, { status: 500 }),
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
 * GET /api/stick-chats/[chatId]
 * Get a specific chat with details
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

    const chat = await getChatById(chatId, user.id)
    if (!chat) {
      return Errors.notFound()
    }

    return NextResponse.json({ chat })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChat] GET error:", error)
    return Errors.internal()
  }
}

/**
 * PATCH /api/stick-chats/[chatId]
 * Update a chat (owner only)
 */
export async function PATCH(
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

    const body: UpdateStickChatRequest = await request.json()
    const { name, extend_expiry_days } = body

    const chat = await updateChat(chatId, user.id, { name, extend_expiry_days })
    if (!chat) {
      return Errors.updateFailed()
    }

    return NextResponse.json({ chat })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChat] PATCH error:", error)
    return Errors.internal()
  }
}

/**
 * DELETE /api/stick-chats/[chatId]
 * Delete a chat (owner only)
 */
export async function DELETE(
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

    const deleted = await deleteChat(chatId, user.id)
    if (deleted === 0) {
      return Errors.deleteFailed()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChat] DELETE error:", error)
    return Errors.internal()
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getChatById,
  updateChat,
  deleteChat,
} from "@/lib/database/stick-chat-queries"
import { authenticateWithOrg, handleRateLimitError } from "@/lib/handlers/stick-chats-handler"
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
  notFound: () => NextResponse.json({ error: "Chat not found" }, { status: 404 }),
  updateFailed: () => NextResponse.json({ error: "Failed to update chat" }, { status: 500 }),
  deleteFailed: () => NextResponse.json({ error: "Failed to delete chat" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

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
    const auth = await authenticateWithOrg()
    if (!auth.ok) return auth.response

    const chat = await getChatById(chatId, auth.user.id)
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
    const auth = await authenticateWithOrg()
    if (!auth.ok) return auth.response

    const body: UpdateStickChatRequest = await request.json()
    const { name, extend_expiry_days } = body

    const chat = await updateChat(chatId, auth.user.id, { name, extend_expiry_days })
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
    const auth = await authenticateWithOrg()
    if (!auth.ok) return auth.response

    const deleted = await deleteChat(chatId, auth.user.id)
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

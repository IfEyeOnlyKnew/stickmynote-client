import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { isChatMember, getChatMemberUserIds } from "@/lib/database/stick-chat-queries"
import { publishToUsers } from "@/lib/ws/publish-event"

/**
 * TYPING INDICATOR API
 *
 * POST /api/stick-chats/[chatId]/typing
 * Broadcasts typing status via WebSocket to other members
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { chatId } = await params
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const isMember = await isChatMember(chatId, user.id)
    if (!isMember) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    // Broadcast typing event via WebSocket (ephemeral, no DB persistence needed)
    const memberIds = await getChatMemberUserIds(chatId)
    const otherMembers = memberIds.filter((id) => id !== user.id)
    if (otherMembers.length > 0) {
      await publishToUsers(otherMembers, {
        type: "chat.typing",
        payload: {
          chatId,
          userId: user.id,
          userName: user.email ?? "User",
        },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Typing] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

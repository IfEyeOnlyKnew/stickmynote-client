import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { isChatMember, toggleReaction, getChatMemberUserIds } from "@/lib/database/stick-chat-queries"
import { publishToUsers } from "@/lib/ws/publish-event"

/**
 * REACTIONS API
 *
 * POST /api/stick-chats/[chatId]/reactions
 * Body: { messageId: string, emoji: string }
 * Toggles a reaction (add if not exists, remove if exists)
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
      return NextResponse.json({ error: "Not a member of this chat" }, { status: 403 })
    }

    const { messageId, emoji } = await request.json()
    if (!messageId || !emoji) {
      return NextResponse.json({ error: "messageId and emoji are required" }, { status: 400 })
    }

    const result = await toggleReaction(messageId, user.id, emoji)

    // Broadcast to all members
    const memberIds = await getChatMemberUserIds(chatId)
    const otherMembers = memberIds.filter((id) => id !== user.id)
    if (otherMembers.length > 0) {
      await publishToUsers(otherMembers, {
        type: "chat.reaction",
        payload: {
          chatId,
          messageId,
          emoji,
          userId: user.id,
          userName: user.email ?? "User",
          added: result.added,
        },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Reactions] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

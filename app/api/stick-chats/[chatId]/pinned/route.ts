import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { isChatMember, pinMessage, unpinMessage, getPinnedMessages, getChatMemberUserIds } from "@/lib/database/stick-chat-queries"
import { publishToUsers } from "@/lib/ws/publish-event"

/**
 * PINNED MESSAGES API
 *
 * GET    /api/stick-chats/[chatId]/pinned - List pinned messages
 * POST   /api/stick-chats/[chatId]/pinned - Pin a message
 * DELETE /api/stick-chats/[chatId]/pinned - Unpin a message
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const isMember = await isChatMember(chatId, user.id)
    if (!isMember) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    const pinned = await getPinnedMessages(chatId)
    return NextResponse.json({ pinned })
  } catch (error) {
    console.error("[Pinned] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const { messageId } = await request.json()
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }

    const pinned = await pinMessage(chatId, messageId, user.id)

    // Broadcast pin event
    const memberIds = await getChatMemberUserIds(chatId)
    const otherMembers = memberIds.filter((id) => id !== user.id)
    if (otherMembers.length > 0) {
      await publishToUsers(otherMembers, {
        type: "chat.pinned",
        payload: { chatId, messageId, pinnedBy: user.id },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ pinned }, { status: 201 })
  } catch (error) {
    console.error("[Pinned] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }

    await unpinMessage(chatId, messageId)

    const memberIds = await getChatMemberUserIds(chatId)
    const otherMembers = memberIds.filter((id) => id !== user.id)
    if (otherMembers.length > 0) {
      await publishToUsers(otherMembers, {
        type: "chat.unpinned",
        payload: { chatId, messageId },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Pinned] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

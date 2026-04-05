import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { isChatMember, getThreadReplies } from "@/lib/database/stick-chat-queries"

/**
 * THREAD REPLIES API
 *
 * GET /api/stick-chats/[chatId]/thread/[messageId]
 * Get all replies to a specific message thread
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string; messageId: string }> }
) {
  try {
    const { chatId, messageId } = await params
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const isMember = await isChatMember(chatId, user.id)
    if (!isMember) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const cursor = searchParams.get("cursor") || undefined

    const result = await getThreadReplies(messageId, { limit, cursor })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Thread] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

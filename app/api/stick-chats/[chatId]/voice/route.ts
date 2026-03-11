import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  isChatMember,
  joinVoiceChannel,
  leaveVoiceChannel,
  getVoiceParticipants,
  getChatMemberUserIds,
} from "@/lib/database/stick-chat-queries"
import { publishToUsers } from "@/lib/ws/publish-event"
import { createLiveKitToken } from "@/lib/livekit/token"

/**
 * VOICE CHANNEL API
 *
 * GET    /api/stick-chats/[chatId]/voice - Get participants + token
 * POST   /api/stick-chats/[chatId]/voice - Join voice channel
 * DELETE /api/stick-chats/[chatId]/voice - Leave voice channel
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

    const participants = await getVoiceParticipants(chatId)

    // Generate a LiveKit token for the voice channel
    const roomName = `voice-${chatId}`
    const displayName = user.email ?? "User"
    const token = await createLiveKitToken(roomName, user.id, displayName)

    return NextResponse.json({ participants, token, roomName })
  } catch (error) {
    console.error("[Voice] GET error:", error)
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

    await joinVoiceChannel(chatId, user.id)

    // Broadcast join event
    const memberIds = await getChatMemberUserIds(chatId)
    const otherMembers = memberIds.filter((id) => id !== user.id)
    if (otherMembers.length > 0) {
      await publishToUsers(otherMembers, {
        type: "voice.joined",
        payload: {
          chatId,
          userId: user.id,
          userName: user.email ?? "User",
        },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ joined: true })
  } catch (error) {
    console.error("[Voice] POST error:", error)
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

    await leaveVoiceChannel(chatId, user.id)

    // Broadcast leave event
    const memberIds = await getChatMemberUserIds(chatId)
    const otherMembers = memberIds.filter((id) => id !== user.id)
    if (otherMembers.length > 0) {
      await publishToUsers(otherMembers, {
        type: "voice.left",
        payload: { chatId, userId: user.id },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ left: true })
  } catch (error) {
    console.error("[Voice] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

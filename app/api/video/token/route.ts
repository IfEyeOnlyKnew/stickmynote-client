import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import { createLiveKitToken } from "@/lib/livekit/token"

export const dynamic = "force-dynamic"

/**
 * GET /api/video/token?roomName=xxx
 * Returns a LiveKit access token for the authenticated user to join a room.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const roomName = searchParams.get("roomName")

    if (!roomName) {
      return NextResponse.json({ error: "roomName is required" }, { status: 400 })
    }

    // Get user display name
    const userResult = await db.query(
      `SELECT full_name, username, email FROM users WHERE id = $1`,
      [user.id],
    )
    const profile = userResult.rows[0]
    const displayName = profile?.full_name || profile?.username || profile?.email || "Guest"

    const token = await createLiveKitToken(roomName, user.id, displayName)

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[Video Token] Error:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}

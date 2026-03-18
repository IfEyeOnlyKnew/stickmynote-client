import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// In-memory typing status (in production, use Redis or database)
// This is a simple in-memory store that expires entries after 5 seconds
const typingUsers = new Map<string, Map<string, { name: string; expiresAt: number }>>()

// Clean up expired typing entries
function cleanupExpiredTyping(padId: string) {
  const padTyping = typingUsers.get(padId)
  if (!padTyping) return

  const now = Date.now()
  for (const [userId, data] of padTyping) {
    if (data.expiresAt < now) {
      padTyping.delete(userId)
    }
  }
}

// ============================================================================
// GET - Get users currently typing in the chat
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    // Cleanup expired entries
    cleanupExpiredTyping(padId)

    const padTyping = typingUsers.get(padId)
    if (!padTyping) {
      return NextResponse.json({ typing: [] })
    }

    // Filter out current user and return typing users
    const currentUserId = authResult.user.id
    const typing = Array.from(padTyping.entries())
      .filter(([userId]) => userId !== currentUserId)
      .map(([userId, data]) => ({
        user_id: userId,
        name: data.name,
      }))

    return NextResponse.json({ typing })
  } catch (error) {
    console.error("[ChatTyping] GET error:", error)
    return NextResponse.json({ typing: [] })
  }
}

// ============================================================================
// POST - Set/clear typing status
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const userId = authResult.user.id
    const body = await request.json()
    const { typing } = body

    // Get user's display name
    const db = await createServiceDatabaseClient()
    const { data: userData } = await db
      .from("users")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle()

    const displayName = userData?.full_name || userData?.email?.split("@")[0] || "Someone"

    // Ensure pad map exists
    if (!typingUsers.has(padId)) {
      typingUsers.set(padId, new Map())
    }

    const padTyping = typingUsers.get(padId)!

    if (typing) {
      // User started typing - expires in 5 seconds
      padTyping.set(userId, {
        name: displayName,
        expiresAt: Date.now() + 5000,
      })
    } else {
      // User stopped typing
      padTyping.delete(userId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ChatTyping] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

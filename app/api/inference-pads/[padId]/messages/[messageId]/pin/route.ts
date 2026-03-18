import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// ============================================================================
// Helpers
// ============================================================================

async function canPinMessage(db: any, padId: string, userId: string): Promise<boolean> {
  // Check if user is pad owner
  const { data: pad } = await db
    .from("social_pads")
    .select("owner_id")
    .eq("id", padId)
    .maybeSingle()

  if (pad?.owner_id === userId) return true

  // Check if user is a moderator with pin permission
  const { data: moderator } = await db
    .from("social_pad_chat_moderators")
    .select("can_pin")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()

  return !!moderator?.can_pin
}

// ============================================================================
// POST - Toggle pin status on a message
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; messageId: string }> }
) {
  try {
    const { padId, messageId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()
    const userId = authResult.user.id

    // Check permissions
    const canPin = await canPinMessage(db, padId, userId)
    if (!canPin) {
      return NextResponse.json({ error: "Only pad owner or moderators can pin messages" }, { status: 403 })
    }

    // Get current pin status
    const { data: message } = await db
      .from("social_pad_messages")
      .select("is_pinned")
      .eq("id", messageId)
      .eq("social_pad_id", padId)
      .maybeSingle()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const newPinStatus = !message.is_pinned

    // Toggle pin status
    const { error } = await db
      .from("social_pad_messages")
      .update({
        is_pinned: newPinStatus,
        pinned_by: newPinStatus ? userId : null,
        pinned_at: newPinStatus ? new Date().toISOString() : null,
      })
      .eq("id", messageId)
      .eq("social_pad_id", padId)

    if (error) {
      // If columns don't exist, try simple update
      if (error.code === "42703") {
        console.warn("[PadMessages] Pin columns not found, skipping pin")
        return NextResponse.json({
          success: true,
          is_pinned: false,
          message: "Pin feature not available - migration required"
        })
      }
      console.error("[PadMessages] Pin error:", error)
      return NextResponse.json({ error: "Failed to pin message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      is_pinned: newPinStatus,
    })
  } catch (error) {
    console.error("[PadMessages] PIN error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

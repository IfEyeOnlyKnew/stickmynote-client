import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// ============================================================================
// DELETE - Remove a moderator
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; moderatorId: string }> }
) {
  try {
    const { padId, moderatorId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    // Only pad owner can remove moderators
    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .maybeSingle()

    if (pad?.owner_id !== authResult.user.id) {
      return NextResponse.json({ error: "Only pad owner can remove moderators" }, { status: 403 })
    }

    // Delete the moderator
    const { error } = await db
      .from("social_pad_chat_moderators")
      .delete()
      .eq("id", moderatorId)
      .eq("social_pad_id", padId)

    if (error) {
      console.error("[ChatModerators] Error deleting:", error)
      return NextResponse.json({ error: "Failed to remove moderator" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ChatModerators] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

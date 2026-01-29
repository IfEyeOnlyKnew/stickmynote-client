import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// ============================================================================
// Helpers
// ============================================================================

async function canDeleteMessage(
  db: any,
  padId: string,
  messageId: string,
  userId: string
): Promise<{ allowed: boolean; isOwner: boolean; isModerator: boolean }> {
  // Check if user is pad owner
  const { data: pad } = await db
    .from("social_pads")
    .select("owner_id")
    .eq("id", padId)
    .maybeSingle()

  const isOwner = pad?.owner_id === userId

  // Check if user is a moderator with delete permission
  const { data: moderator } = await db
    .from("social_pad_chat_moderators")
    .select("can_delete")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()

  const isModerator = !!moderator?.can_delete

  // Check if user owns the message
  const { data: message } = await db
    .from("social_pad_messages")
    .select("user_id")
    .eq("id", messageId)
    .eq("social_pad_id", padId)
    .maybeSingle()

  const isMessageOwner = message?.user_id === userId

  return {
    allowed: isOwner || isModerator || isMessageOwner,
    isOwner,
    isModerator,
  }
}

// ============================================================================
// DELETE - Delete a message
// ============================================================================

export async function DELETE(
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
    const { allowed, isOwner, isModerator } = await canDeleteMessage(db, padId, messageId, userId)
    if (!allowed) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    // Soft delete by marking as deleted
    const { error } = await db
      .from("social_pad_messages")
      .update({
        is_deleted: true,
        deleted_by: userId,
      })
      .eq("id", messageId)
      .eq("social_pad_id", padId)

    if (error) {
      // If column doesn't exist, do hard delete
      if (error.code === "42703") {
        const { error: hardDeleteError } = await db
          .from("social_pad_messages")
          .delete()
          .eq("id", messageId)
          .eq("social_pad_id", padId)

        if (hardDeleteError) {
          console.error("[PadMessages] Hard delete error:", hardDeleteError)
          return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
        }
      } else {
        console.error("[PadMessages] Soft delete error:", error)
        return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      deletedBy: isOwner ? "owner" : isModerator ? "moderator" : "author",
    })
  } catch (error) {
    console.error("[PadMessages] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PUT - Edit a message
// ============================================================================

export async function PUT(
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

    // Only message owner can edit
    const { data: message } = await db
      .from("social_pad_messages")
      .select("user_id")
      .eq("id", messageId)
      .eq("social_pad_id", padId)
      .maybeSingle()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (message.user_id !== userId) {
      return NextResponse.json({ error: "Only message author can edit" }, { status: 403 })
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Update the message
    const { data: updatedMessage, error } = await db
      .from("social_pad_messages")
      .update({
        content: content.trim(),
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("social_pad_id", padId)
      .select()
      .single()

    if (error) {
      // If is_edited column doesn't exist, just update content
      if (error.code === "42703") {
        const { data: simpleUpdate, error: simpleError } = await db
          .from("social_pad_messages")
          .update({ content: content.trim() })
          .eq("id", messageId)
          .eq("social_pad_id", padId)
          .select()
          .single()

        if (simpleError) {
          console.error("[PadMessages] Simple update error:", simpleError)
          return NextResponse.json({ error: "Failed to edit message" }, { status: 500 })
        }

        return NextResponse.json({ message: simpleUpdate })
      }

      console.error("[PadMessages] Update error:", error)
      return NextResponse.json({ error: "Failed to edit message" }, { status: 500 })
    }

    return NextResponse.json({ message: updatedMessage })
  } catch (error) {
    console.error("[PadMessages] PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

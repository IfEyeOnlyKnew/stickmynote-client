import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { AVAILABLE_REACTIONS } from "@/types/pad-chat"

export const dynamic = "force-dynamic"

// ============================================================================
// POST - Toggle a reaction on a message
// ============================================================================

async function verifyPadAccess(db: any, padId: string, userId: string): Promise<NextResponse | null> {
  const { data: pad } = await db
    .from("social_pads")
    .select("id, is_public, owner_id")
    .eq("id", padId)
    .maybeSingle()

  if (!pad) {
    return NextResponse.json({ error: "Pad not found" }, { status: 404 })
  }

  if (pad.owner_id === userId || pad.is_public) return null

  const { data: membership } = await db
    .from("social_pad_members")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  return null
}

async function removeReaction(db: any, reactionId: string, emoji: string): Promise<NextResponse> {
  const { error: deleteError } = await db
    .from("social_pad_message_reactions")
    .delete()
    .eq("id", reactionId)

  if (deleteError) {
    console.error("[Reactions] Delete error:", deleteError)
    return NextResponse.json({ error: "Failed to remove reaction" }, { status: 500 })
  }

  return NextResponse.json({ action: "removed", emoji })
}

async function addReaction(db: any, messageId: string, userId: string, emoji: string): Promise<NextResponse> {
  const { error: insertError } = await db
    .from("social_pad_message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji })

  if (insertError) {
    if (insertError.code === "42P01") {
      return NextResponse.json({ action: "skipped", message: "Reactions table not available - migration required" })
    }
    console.error("[Reactions] Insert error:", insertError)
    return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 })
  }

  return NextResponse.json({ action: "added", emoji })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; messageId: string }> }
) {
  try {
    const { padId, messageId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const db = await createServiceDatabaseClient()
    const userId = authResult.user.id

    const body = await request.json()
    const { emoji } = body

    if (!emoji || !AVAILABLE_REACTIONS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid reaction emoji" }, { status: 400 })
    }

    // Verify message exists in this pad
    const { data: message } = await db
      .from("social_pad_messages")
      .select("id, social_pad_id")
      .eq("id", messageId)
      .eq("social_pad_id", padId)
      .maybeSingle()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Verify pad access
    const accessError = await verifyPadAccess(db, padId, userId)
    if (accessError) return accessError

    // Toggle reaction
    const { data: existingReaction } = await db
      .from("social_pad_message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle()

    if (existingReaction) {
      return removeReaction(db, existingReaction.id, emoji)
    }
    return addReaction(db, messageId, userId, emoji)
  } catch (error) {
    console.error("[Reactions] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// GET - Get reactions for a message
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; messageId: string }> }
) {
  try {
    const { messageId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()
    const userId = authResult.user.id

    // Fetch all reactions for this message
    const { data: reactions, error } = await db
      .from("social_pad_message_reactions")
      .select("emoji, user_id")
      .eq("message_id", messageId)

    if (error) {
      // Table might not exist
      if (error.code === "42P01") {
        return NextResponse.json({ reactions: [] })
      }
      console.error("[Reactions] Fetch error:", error)
      return NextResponse.json({ reactions: [] })
    }

    // Group by emoji and include whether current user reacted
    const reactionMap = new Map<string, { count: number; users: string[]; user_reacted: boolean }>()

    for (const reaction of reactions || []) {
      if (!reactionMap.has(reaction.emoji)) {
        reactionMap.set(reaction.emoji, { count: 0, users: [], user_reacted: false })
      }
      const entry = reactionMap.get(reaction.emoji)!
      entry.count++
      entry.users.push(reaction.user_id)
      if (reaction.user_id === userId) {
        entry.user_reacted = true
      }
    }

    const groupedReactions = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    }))

    return NextResponse.json({ reactions: groupedReactions })
  } catch (error) {
    console.error("[Reactions] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

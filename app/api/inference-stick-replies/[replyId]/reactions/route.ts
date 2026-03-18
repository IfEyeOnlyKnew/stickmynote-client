import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"
import { getOrgContext } from "@/lib/auth/get-org-context"

// Create reactions table for replies
export async function GET(request: Request, { params }: { params: Promise<{ replyId: string }> }) {
  try {
    const { replyId } = await params
    const db = await createDatabaseClient()

    // Get all reactions for this reply with user data
    const { data: reactions, error } = await db
      .from("social_reply_reactions")
      .select(`
        *,
        users:user_id (id, full_name, username, avatar_url)
      `)
      .eq("social_reply_id", replyId)
      .order("created_at", { ascending: false })

    if (error) {
      // Table might not exist yet, return empty array
      if (error.code === "42P01") {
        return NextResponse.json({ reactions: [], reactionCounts: {} })
      }
      throw error
    }

    // Aggregate reactions by type
    const reactionCounts = reactions?.reduce(
      (acc, reaction) => {
        acc[reaction.reaction_type] = (acc[reaction.reaction_type] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return NextResponse.json({ reactions, reactionCounts })
  } catch (error) {
    console.error("Error fetching reply reactions:", error)
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ replyId: string }> }) {
  try {
    const { replyId } = await params
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const { reaction_type } = await request.json()

    // Check if user already reacted with this type
    const { data: existing } = await db
      .from("social_reply_reactions")
      .select("id")
      .eq("social_reply_id", replyId)
      .eq("user_id", user.id)
      .eq("reaction_type", reaction_type)
      .maybeSingle()

    // Helper to publish reaction events
    const publishReactionEvent = (added: boolean) => {
      getOrgContext().then((orgContext) => {
        if (!orgContext) return
        const eventType = added ? "reaction.added" : "reaction.removed"
        publishToOrg(orgContext.orgId, {
          type: eventType,
          payload: { targetId: replyId, targetType: "reply", userId: user.id, reactionType: reaction_type },
          timestamp: Date.now(),
        })
        if (reaction_type === "heart") {
          publishToOrg(orgContext.orgId, {
            type: added ? "like.added" : "like.removed",
            payload: { targetId: replyId, targetType: "reply", userId: user.id },
            timestamp: Date.now(),
          })
        }
      }).catch(() => {})
    }

    if (existing) {
      // Remove the reaction if it already exists (toggle behavior)
      const { error } = await db.from("social_reply_reactions").delete().eq("id", existing.id)

      if (error) throw error

      publishReactionEvent(false)
      return NextResponse.json({ removed: true, reactionType: reaction_type })
    } else {
      // Add the new reaction
      const { data: reaction, error } = await db
        .from("social_reply_reactions")
        .insert({
          social_reply_id: replyId,
          user_id: user.id,
          reaction_type,
        })
        .select()
        .single()

      if (error) throw error

      publishReactionEvent(true)
      return NextResponse.json({ reaction, added: true })
    }
  } catch (error) {
    console.error("Error adding/removing reply reaction:", error)
    return NextResponse.json({ error: "Failed to process reaction" }, { status: 500 })
  }
}

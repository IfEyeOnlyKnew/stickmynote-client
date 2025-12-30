import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()
    const noteId = id

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: note, error: noteError } = await db
      .from("personal_sticks")
      .select("id, user_id, is_shared")
      .eq("id", noteId)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    // Allow liking if: user owns the note OR note is shared
    if (note.user_id !== user.id && !note.is_shared) {
      return NextResponse.json({ error: "Cannot like private notes" }, { status: 403 })
    }

    const { data: existingReaction } = await db
      .from("personal_sticks_reactions")
      .select("id")
      .eq("personal_stick_id", noteId)
      .eq("user_id", user.id)
      .eq("reaction_type", "like")
      .maybeSingle()

    if (existingReaction) {
      // Unlike - delete the reaction
      const { error } = await db.from("personal_sticks_reactions").delete().eq("id", existingReaction.id)

      if (error) throw error

      return NextResponse.json({ success: true, liked: false })
    } else {
      const { error } = await db.from("personal_sticks_reactions").insert({
        personal_stick_id: noteId,
        user_id: user.id,
        reaction_type: "like",
      })

      if (error) throw error

      return NextResponse.json({ success: true, liked: true })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to toggle like"
    console.error("Error toggling like:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()
    const noteId = id

    const authResult = await getCachedAuthUser()
    const user = authResult.user

    const { count, error } = await db
      .from("personal_sticks_reactions")
      .select("*", { count: "exact", head: true })
      .eq("personal_stick_id", noteId)
      .eq("reaction_type", "like")

    if (error) throw error

    let isLiked = false

    if (user) {
      const { data: userReaction } = await db
        .from("personal_sticks_reactions")
        .select("id")
        .eq("personal_stick_id", noteId)
        .eq("user_id", user.id)
        .eq("reaction_type", "like")
        .maybeSingle()

      isLiked = !!userReaction
    }

    return NextResponse.json({ likeCount: count || 0, isLiked })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get like count"
    console.error("Error getting like count:", message)
    return NextResponse.json({ likeCount: 0, isLiked: false })
  }
}

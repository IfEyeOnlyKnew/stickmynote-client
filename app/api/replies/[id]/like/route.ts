import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const replyId = params.id

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { data: existingReaction } = await supabase
      .from("reply_reactions")
      .select("id")
      .eq("reply_id", replyId)
      .eq("user_id", user.id)
      .eq("reaction_type", "like")
      .maybeSingle()

    if (existingReaction) {
      // Unlike - delete the reaction
      const { error } = await supabase.from("reply_reactions").delete().eq("id", existingReaction.id)

      if (error) throw error

      return NextResponse.json({ success: true, liked: false })
    } else {
      // Like - insert a reaction
      const { error } = await supabase.from("reply_reactions").insert({
        reply_id: replyId,
        user_id: user.id,
        reaction_type: "like",
      })

      if (error) throw error

      return NextResponse.json({ success: true, liked: true })
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to toggle like"
    console.error("[v0] Error toggling reply like:", error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const replyId = params.id

    // Get total like count
    const { count, error } = await supabase
      .from("reply_reactions")
      .select("*", { count: "exact", head: true })
      .eq("reply_id", replyId)
      .eq("reaction_type", "like")

    if (error) throw error

    const authResult = await getCachedAuthUser(supabase)
    let isLiked = false

    if (authResult.user && !authResult.rateLimited) {
      const { data: userReaction } = await supabase
        .from("reply_reactions")
        .select("id")
        .eq("reply_id", replyId)
        .eq("user_id", authResult.user.id)
        .eq("reaction_type", "like")
        .maybeSingle()

      isLiked = !!userReaction
    }

    return NextResponse.json({ likeCount: count || 0, isLiked })
  } catch (error: unknown) {
    console.error("[v0] Error getting reply like count:", error)
    return NextResponse.json({ likeCount: 0, isLiked: false })
  }
}

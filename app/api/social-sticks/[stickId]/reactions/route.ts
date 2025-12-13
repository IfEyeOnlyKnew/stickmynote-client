import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const { stickId } = params

    // Get all reactions for this stick with user data
    const { data: reactions, error } = await supabase
      .from("social_stick_reactions")
      .select(`
        *,
        users:user_id (id, full_name, username, avatar_url)
      `)
      .eq("social_stick_id", stickId)
      .order("created_at", { ascending: false })

    if (error) throw error

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
    console.error("Error fetching reactions:", error)
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const { stickId } = params
    const { reaction_type } = await request.json()

    // Check if user already reacted with this type
    const { data: existing } = await supabase
      .from("social_stick_reactions")
      .select("id")
      .eq("social_stick_id", stickId)
      .eq("user_id", user.id)
      .eq("reaction_type", reaction_type)
      .maybeSingle()

    if (existing) {
      // Remove the reaction if it already exists (toggle behavior)
      const { error } = await supabase.from("social_stick_reactions").delete().eq("id", existing.id)

      if (error) throw error

      return NextResponse.json({ removed: true, reactionType: reaction_type })
    } else {
      // Add the new reaction
      const { data: reaction, error } = await supabase
        .from("social_stick_reactions")
        .insert({
          social_stick_id: stickId,
          user_id: user.id,
          reaction_type,
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ reaction, added: true })
    }
  } catch (error) {
    console.error("Error adding/removing reaction:", error)
    return NextResponse.json({ error: "Failed to process reaction" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const { stickId } = params
    const { searchParams } = new URL(request.url)
    const reactionType = searchParams.get("reactionType")

    if (!reactionType) {
      return NextResponse.json({ error: "Reaction type is required" }, { status: 400 })
    }

    // Remove user's reaction
    const { error } = await supabase
      .from("social_stick_reactions")
      .delete()
      .eq("social_stick_id", stickId)
      .eq("user_id", user.id)
      .eq("reaction_type", reactionType)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing reaction:", error)
    return NextResponse.json({ error: "Failed to remove reaction" }, { status: 500 })
  }
}

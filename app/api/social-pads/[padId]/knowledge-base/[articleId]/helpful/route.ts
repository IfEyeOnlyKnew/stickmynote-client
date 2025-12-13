import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// POST: Mark article as helpful
export async function POST(request: NextRequest, { params }: { params: { padId: string; articleId: string } }) {
  try {
    const supabase = await createServerClient()
    const { articleId } = params

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

    // Insert helpful vote
    const { error } = await supabase.from("social_kb_helpful_votes").insert({
      kb_article_id: articleId,
      user_id: user.id,
    })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already marked as helpful" }, { status: 400 })
      }
      console.error("[v0] Error marking article as helpful:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in POST /api/social-pads/[padId]/knowledge-base/[articleId]/helpful:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Remove helpful vote
export async function DELETE(request: NextRequest, { params }: { params: { padId: string; articleId: string } }) {
  try {
    const supabase = await createServerClient()
    const { articleId } = params

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

    const { error } = await supabase
      .from("social_kb_helpful_votes")
      .delete()
      .eq("kb_article_id", articleId)
      .eq("user_id", user.id)

    if (error) {
      console.error("[v0] Error removing helpful vote:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/social-pads/[padId]/knowledge-base/[articleId]/helpful:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

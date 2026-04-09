import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { requireAuth } from "@/lib/api/route-helpers"

// POST: Mark article as helpful
export async function POST(request: NextRequest, { params }: { params: Promise<{ padId: string; articleId: string }> }) {
  try {
    const { articleId } = await params
    const db = await createDatabaseClient()

    const auth = await requireAuth()
    if ("response" in auth) return auth.response
    const { user } = auth

    // Insert helpful vote
    const { error } = await db.from("social_kb_helpful_votes").insert({
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
    console.error("[v0] Error in POST /api/inference-pads/[padId]/knowledge-base/[articleId]/helpful:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Remove helpful vote
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ padId: string; articleId: string }> }) {
  try {
    const { articleId } = await params
    const db = await createDatabaseClient()

    const auth = await requireAuth()
    if ("response" in auth) return auth.response
    const { user } = auth

    const { error } = await db
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
    console.error("[v0] Error in DELETE /api/inference-pads/[padId]/knowledge-base/[articleId]/helpful:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

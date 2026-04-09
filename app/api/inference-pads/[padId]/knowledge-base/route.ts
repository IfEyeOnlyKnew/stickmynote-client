import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api/route-helpers"
import {
  getKnowledgeBaseArticles,
  createKnowledgeBaseArticle,
  updateKnowledgeBaseArticle,
  deleteKnowledgeBaseArticle,
} from "@/lib/handlers/inference-pads-knowledge-base-handler"

// GET: Fetch all KB articles for a pad
export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

    const auth = await requireAuth()
    if ("response" in auth) return auth.response

    const articles = await getKnowledgeBaseArticles(padId)
    return NextResponse.json({ articles })
  } catch (error) {
    console.error("[v0] Error in GET /api/inference-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a new KB article
export async function POST(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

    const auth = await requireAuth()
    if ("response" in auth) return auth.response
    const { user } = auth

    const body = await request.json()
    const { title, content, category, tags } = body

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    const article = await createKnowledgeBaseArticle(padId, user.id, { title, content, category, tags })
    if (!article) {
      return NextResponse.json({ error: "Failed to create article" }, { status: 500 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error("[v0] Error in POST /api/inference-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: Update a KB article
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

    const auth = await requireAuth()
    if ("response" in auth) return auth.response

    const body = await request.json()
    const { articleId, title, content, category, tags, is_pinned, pin_order } = body

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
    }

    const article = await updateKnowledgeBaseArticle(padId, articleId, { title, content, category, tags, is_pinned, pin_order })

    if (article === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }
    if (article === null) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error("[v0] Error in PATCH /api/inference-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a KB article
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

    const auth = await requireAuth()
    if ("response" in auth) return auth.response

    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get("articleId")

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
    }

    await deleteKnowledgeBaseArticle(padId, articleId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/inference-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

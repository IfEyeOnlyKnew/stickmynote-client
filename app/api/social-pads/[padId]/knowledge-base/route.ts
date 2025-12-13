import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

async function attachAuthorToArticle(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  article: Record<string, unknown>,
) {
  if (article.author_id) {
    const { data: author } = await supabase
      .from("users")
      .select("id, full_name, email, avatar_url")
      .eq("id", article.author_id as string)
      .maybeSingle()
    return { ...article, author: author || null }
  }
  return { ...article, author: null }
}

// GET: Fetch all KB articles for a pad
export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const { padId } = params

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

    const { data: articles, error } = await supabase
      .from("social_pad_knowledge_base")
      .select("*")
      .eq("social_pad_id", padId)
      .order("is_pinned", { ascending: false })
      .order("pin_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching KB articles:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const articlesWithAuthors = await Promise.all(
      (articles || []).map((article) => attachAuthorToArticle(supabase, article)),
    )

    return NextResponse.json({ articles: articlesWithAuthors })
  } catch (error) {
    console.error("[v0] Error in GET /api/social-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a new KB article
export async function POST(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const { padId } = params

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

    const body = await request.json()
    const { title, content, category, tags } = body

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    const { data: article, error } = await supabase
      .from("social_pad_knowledge_base")
      .insert({
        social_pad_id: padId,
        title,
        content,
        category: category || "general",
        tags: tags || [],
        author_id: user.id,
      })
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("[v0] Error creating KB article:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!article) {
      return NextResponse.json({ error: "Failed to create article" }, { status: 500 })
    }

    const articleWithAuthor = await attachAuthorToArticle(supabase, article)

    return NextResponse.json({ article: articleWithAuthor })
  } catch (error) {
    console.error("[v0] Error in POST /api/social-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: Update a KB article
export async function PATCH(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const { padId } = params

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

    const body = await request.json()
    const { articleId, title, content, category, tags, is_pinned, pin_order } = body

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = tags
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned
    if (pin_order !== undefined) updateData.pin_order = pin_order

    const { data: article, error } = await supabase
      .from("social_pad_knowledge_base")
      .update(updateData)
      .eq("id", articleId)
      .eq("social_pad_id", padId)
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("[v0] Error updating KB article:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    const articleWithAuthor = await attachAuthorToArticle(supabase, article)

    return NextResponse.json({ article: articleWithAuthor })
  } catch (error) {
    console.error("[v0] Error in PATCH /api/social-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a KB article
export async function DELETE(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const { padId } = params

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

    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get("articleId")

    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("social_pad_knowledge_base")
      .delete()
      .eq("id", articleId)
      .eq("social_pad_id", padId)

    if (error) {
      console.error("[v0] Error deleting KB article:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/social-pads/[padId]/knowledge-base:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

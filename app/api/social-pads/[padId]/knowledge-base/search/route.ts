import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// GET: Search KB articles by tags for semantic matching
export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const db = await createDatabaseClient()
    const { padId } = params
    const { searchParams } = new URL(request.url)
    const tags = searchParams.get("tags")?.split(",") || []
    const query = searchParams.get("query") || ""

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let queryBuilder = db.from("social_pad_knowledge_base").select("*").eq("social_pad_id", padId)

    // Search by tags (semantic similarity)
    if (tags.length > 0) {
      queryBuilder = queryBuilder.overlaps("tags", tags)
    }

    // Search by text query
    if (query) {
      queryBuilder = queryBuilder.or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    }

    const { data: articles, error } = await queryBuilder
      .order("helpful_count", { ascending: false })
      .order("view_count", { ascending: false })
      .limit(10)

    if (error) {
      console.error("[v0] Error searching KB articles:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const articlesWithAuthors = await Promise.all(
      (articles || []).map(async (article) => {
        if (article.author_id) {
          const { data: author } = await db
            .from("users")
            .select("id, full_name, email, avatar_url")
            .eq("id", article.author_id)
            .single()
          return { ...article, author: author || null }
        }
        return { ...article, author: null }
      }),
    )

    return NextResponse.json({ articles: articlesWithAuthors })
  } catch (error) {
    console.error("[v0] Error in GET /api/social-pads/[padId]/knowledge-base/search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

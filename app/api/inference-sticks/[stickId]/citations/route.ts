import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// GET: Fetch citations for a stick
export async function GET(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }
    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const { data: citations, error } = await db
      .from("social_stick_citations")
      .select("*")
      .eq("stick_id", stickId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching citations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch related KB articles separately
    const kbArticleIds = [...new Set((citations || []).map((c: any) => c.kb_article_id).filter(Boolean))]
    let kbArticleMap: Record<string, { id: string; title: string; category: string; tags: string[] }> = {}
    if (kbArticleIds.length > 0) {
      const { data: kbArticles } = await db
        .from("social_pad_knowledge_base")
        .select("id, title, category, tags")
        .in("id", kbArticleIds)

      if (kbArticles) {
        kbArticleMap = Object.fromEntries(kbArticles.map((kb: any) => [kb.id, kb]))
      }
    }

    const citedByIds = [...new Set((citations || []).map((c: any) => c.cited_by).filter(Boolean))]
    let usersMap: Record<
      string,
      { id: string; full_name: string | null; email: string | null; avatar_url: string | null }
    > = {}

    if (citedByIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, full_name, email, avatar_url")
        .in("id", citedByIds)

      if (users) {
        usersMap = users.reduce(
          (acc, u) => {
            acc[u.id] = u
            return acc
          },
          {} as typeof usersMap,
        )
      }
    }

    // Combine citations with user and kb_article data
    const citationsWithUsers = (citations || []).map((citation: any) => ({
      ...citation,
      kb_article: citation.kb_article_id ? kbArticleMap[citation.kb_article_id] || null : null,
      cited_by_user: citation.cited_by ? usersMap[citation.cited_by] || null : null,
    }))

    return NextResponse.json({ citations: citationsWithUsers })
  } catch (error) {
    console.error("[v0] Error in GET /api/inference-sticks/[stickId]/citations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Add a citation to a stick
export async function POST(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }
    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const body = await request.json()
    const { kb_article_id, citation_type, citation_note, external_url, external_title } = body

    if (!kb_article_id && !external_url) {
      return NextResponse.json({ error: "Either KB article or external URL is required" }, { status: 400 })
    }

    const { data: citation, error } = await db
      .from("social_stick_citations")
      .insert({
        stick_id: stickId,
        kb_article_id: kb_article_id || null,
        citation_type: citation_type || "reference",
        citation_note,
        external_url: external_url || null,
        external_title: external_title || null,
        cited_by: user.id,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating citation:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch related data separately
    const [kbArticleResult, citedByUserResult] = await Promise.all([
      kb_article_id
        ? db.from("social_pad_knowledge_base").select("id, title, category, tags").eq("id", kb_article_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("users").select("id, full_name, email, avatar_url").eq("id", user.id).maybeSingle(),
    ])

    return NextResponse.json({
      citation: {
        ...citation,
        kb_article: kbArticleResult.data || null,
        cited_by_user: citedByUserResult.data || null,
      },
    })
  } catch (error) {
    console.error("[v0] Error in POST /api/inference-sticks/[stickId]/citations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Remove a citation
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }
    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const citationId = searchParams.get("citationId")

    if (!citationId) {
      return NextResponse.json({ error: "Citation ID is required" }, { status: 400 })
    }

    const { error } = await db
      .from("social_stick_citations")
      .delete()
      .eq("id", citationId)
      .eq("stick_id", stickId)

    if (error) {
      console.error("[v0] Error deleting citation:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/inference-sticks/[stickId]/citations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

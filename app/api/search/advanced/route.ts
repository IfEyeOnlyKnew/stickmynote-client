import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// POST /api/search/advanced - Advanced search with filters
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
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
    const { query, filters, page = 1, limit = 20, sortBy = "created_at", sortOrder = "desc" } = body

    let notesQuery = supabase
      .from("notes")
      .select("*, replies:replies(count)", { count: "exact" })
      .eq("user_id", user.id)

    // Apply text search
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase()
      if (query.includes(":")) {
        // Topic-only search
        const keywords = query
          .split(":")
          .map((w: string) => w.trim())
          .filter((w: string) => w)
        keywords.forEach((keyword: string) => {
          notesQuery = notesQuery.ilike("topic", `%${keyword}%`)
        })
      } else {
        // Search both topic and content
        notesQuery = notesQuery.or(`topic.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      }
    }

    // Apply date range filter
    if (filters?.dateRange?.from) {
      notesQuery = notesQuery.gte("created_at", filters.dateRange.from)
    }
    if (filters?.dateRange?.to) {
      notesQuery = notesQuery.lte("created_at", filters.dateRange.to)
    }

    // Apply shared filter
    if (filters?.shared !== null && filters?.shared !== undefined) {
      notesQuery = notesQuery.eq("is_shared", filters.shared)
    }

    // Apply color filter
    if (filters?.color) {
      notesQuery = notesQuery.eq("color", filters.color)
    }

    // Apply sorting
    notesQuery = notesQuery.order(sortBy, { ascending: sortOrder === "asc" })

    // Apply pagination
    const offset = (page - 1) * limit
    notesQuery = notesQuery.range(offset, offset + limit - 1)

    const { data: notes, error: notesError, count } = await notesQuery

    if (notesError) {
      console.error("Error in advanced search:", notesError)
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }

    return NextResponse.json({
      notes: notes || [],
      totalCount: count || 0,
      page,
      hasMore: (count || 0) > page * limit,
    })
  } catch (error) {
    console.error("Error in advanced search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

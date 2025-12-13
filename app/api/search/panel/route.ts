import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { SearchCache } from "@/lib/search-cache"
import { SearchAnalytics } from "@/lib/search-analytics"
import { getCachedAuthUser, createRateLimitResponse } from "@/lib/auth/cached-auth"

interface SearchFilters {
  tags?: string[]
  timeframe?: "day" | "week" | "month" | "all"
  shared?: "all" | "shared" | "personal"
  colors?: string[]
  sortBy?: "relevance" | "newest" | "oldest" | "most_replies"
}

// POST /api/search/panel - Enhanced panel search with full-text search and filters
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          notes: [],
          totalCount: 0,
          page: 1,
          hasMore: false,
          searchDuration: Date.now() - startTime,
          rateLimited: true,
        },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    const { createClient } = await import("@supabase/supabase-js")
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { query, filters = {}, page = 1, limit = 20 } = body
    const { tags, timeframe, colors, sortBy = "newest" } = filters as SearchFilters

    const cacheKey = `panel_search:${query || ""}:${JSON.stringify(filters)}:${page}`
    const cachedResult = await SearchCache.get(cacheKey)
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        searchDuration: Date.now() - startTime,
      })
    }

    let notesQuery = supabaseAdmin.from("personal_sticks").select(
      `
        *,
        personal_sticks_replies (
          id
        ),
        personal_sticks_tags (
          id,
          tag_title
        )
      `,
      { count: "exact" },
    )

    notesQuery = notesQuery.eq("is_shared", true)

    // Apply full-text search if query provided
    if (query && query.trim()) {
      const searchTerm = query.trim()
      const escapedSearchTerm = searchTerm.replace(/[%_\\]/g, "\\$&")

      let matchingUserIds: string[] = []
      if (searchTerm.length >= 3) {
        try {
          const { data: matchingUsers } = await supabaseAdmin
            .from("users")
            .select("id")
            .or(`username.ilike.%${escapedSearchTerm}%,full_name.ilike.%${escapedSearchTerm}%`)
            .limit(10)
          matchingUserIds = matchingUsers?.map((u) => u.id) || []
        } catch (userSearchError) {
          // Ignore user search errors, continue with topic/content search only
          console.warn("User search failed, continuing without user filter")
        }
      }

      if (matchingUserIds.length > 0) {
        notesQuery = notesQuery.or(
          `topic.ilike.%${escapedSearchTerm}%,content.ilike.%${escapedSearchTerm}%,user_id.in.(${matchingUserIds.join(",")})`,
        )
      } else {
        notesQuery = notesQuery.or(`topic.ilike.%${escapedSearchTerm}%,content.ilike.%${escapedSearchTerm}%`)
      }
    }

    // Apply timeframe filter
    if (timeframe && timeframe !== "all") {
      const now = new Date()
      let startDate: Date

      switch (timeframe) {
        case "day":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(0)
      }

      notesQuery = notesQuery.gte("created_at", startDate.toISOString())
    }

    // Apply color filter
    if (colors && colors.length > 0) {
      notesQuery = notesQuery.in("color", colors)
    }

    switch (sortBy) {
      case "newest":
        notesQuery = notesQuery.order("created_at", { ascending: false })
        break
      case "oldest":
        notesQuery = notesQuery.order("created_at", { ascending: true })
        break
      case "relevance":
      default:
        notesQuery = notesQuery.order("created_at", { ascending: false })
    }

    // Apply pagination
    const offset = (page - 1) * limit
    notesQuery = notesQuery.range(offset, offset + limit - 1)

    const { data: notes, error: notesError, count } = await notesQuery

    if (notesError) {
      console.error("Error in panel search:", notesError.message)
      if (notesError.message?.includes("Too Many") || notesError.code === "PGRST") {
        return NextResponse.json({
          notes: [],
          totalCount: 0,
          page,
          hasMore: false,
          searchDuration: Date.now() - startTime,
          rateLimited: true,
        })
      }
      return NextResponse.json({ error: "Search failed", details: notesError.message }, { status: 500 })
    }

    const userIds = [...new Set(notes?.map((note: any) => note.user_id).filter(Boolean))]
    let usersMap: Record<string, any> = {}

    if (userIds.length > 0) {
      try {
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds)

        usersMap = (users || []).reduce(
          (acc, user) => {
            acc[user.id] = user
            return acc
          },
          {} as Record<string, any>,
        )
      } catch (usersError) {
        console.warn("Failed to fetch users, continuing without user data")
      }
    }

    let filteredNotes = notes || []
    if (tags && tags.length > 0) {
      filteredNotes = filteredNotes.filter((note: any) => {
        const noteTags = note.personal_sticks_tags?.map((t: any) => t.tag_title.toLowerCase()) || []
        return tags.some((filterTag) => noteTags.includes(filterTag.toLowerCase()))
      })
    }

    const notesWithCounts = filteredNotes.map((note: any) => ({
      ...note,
      user: usersMap[note.user_id] || null,
      reply_count: note.personal_sticks_replies?.length || 0,
      view_count: Math.floor(Math.random() * 100) + 10,
      like_count: Math.floor(Math.random() * 50),
      tags: note.personal_sticks_tags?.map((t: any) => t.tag_title) || [],
    }))

    const searchDuration = Date.now() - startTime
    const itemsShownSoFar = offset + (notesWithCounts.length || 0)
    const hasMoreValue = (count || 0) > itemsShownSoFar

    if (user && query && query.trim()) {
      try {
        await SearchAnalytics.trackSearch({
          user_id: user.id,
          query: query.trim(),
          filters,
          results_count: notesWithCounts.length,
        })

        await SearchCache.set(
          query,
          {
            notes: notesWithCounts,
            totalCount: count || 0,
          },
          page,
        )
      } catch (analyticsError) {
        // Ignore analytics errors
      }
    }

    return NextResponse.json({
      notes: notesWithCounts,
      totalCount: count || 0,
      page,
      hasMore: hasMoreValue,
      searchDuration,
    })
  } catch (error) {
    console.error("Error in panel search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/search/panel/suggestions - Get search suggestions
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    const suggestions: any = {}

    // Get recent searches
    if (type === "all" || type === "recent") {
      const { data: recentSearches } = await supabase
        .from("search_history")
        .select("query")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)

      suggestions.recent = [...new Set(recentSearches?.map((s: any) => s.query) || [])]
    }

    // Get trending tags from materialized view
    if (type === "all" || type === "trending") {
      const { data: trendingTags } = await supabase.from("trending_tags").select("tag, usage_count").limit(20)

      suggestions.trending = trendingTags?.map((t: any) => t.tag) || []
    }

    // Get all available tags for filtering
    if (type === "all" || type === "tags") {
      const { data: allTags } = await supabase
        .from("personal_sticks_tags")
        .select("tag_title")
        .order("created_at", { ascending: false })
        .limit(50)

      suggestions.tags = [...new Set(allTags?.map((t: any) => t.tag_title) || [])]
    }

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("Error fetching suggestions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

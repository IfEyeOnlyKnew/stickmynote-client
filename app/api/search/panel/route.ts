import { NextResponse } from "next/server"
import { SearchCache } from "@/lib/search-cache"
import { SearchAnalytics } from "@/lib/search-analytics"
import { getCachedAuthUser, createRateLimitResponse } from "@/lib/auth/cached-auth"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"

// Types
interface SearchFilters {
  tags?: string[]
  timeframe?: Timeframe
  shared?: "all" | "shared" | "personal"
  colors?: string[]
  sortBy?: SortOption
}

interface SearchInput {
  query?: string
  filters?: SearchFilters
  page?: number
  limit?: number
}

interface SearchResult {
  notes: EnrichedNote[]
  totalCount: number
  page: number
  hasMore: boolean
  searchDuration: number
  cached?: boolean
  rateLimited?: boolean
}

interface EnrichedNote {
  user: UserInfo | null
  reply_count: number
  view_count: number
  like_count: number
  tags: string[]
  [key: string]: any
}

interface UserInfo {
  id: string
  username: string
  full_name: string
  avatar_url: string
}

interface Suggestions {
  recent: string[]
  trending: string[]
  tags: string[]
}

type Timeframe = "day" | "week" | "month" | "all"
type SortOption = "relevance" | "newest" | "oldest" | "most_replies"

// Constants
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const DEFAULT_SORT: SortOption = "newest"
const MIN_USER_SEARCH_LENGTH = 3
const USER_SEARCH_LIMIT = 10
const RECENT_SEARCH_LIMIT = 5
const TRENDING_TAGS_LIMIT = 20
const ALL_TAGS_LIMIT = 50

const TIMEFRAME_MS: Record<Exclude<Timeframe, "all">, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

const NOTES_SELECT_QUERY = `
  *,
  personal_sticks_replies (id),
  personal_sticks_tags (id, tag_title)
`

// Helper functions
function escapeSearchTerm(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&")
}

function buildCacheKey(query: string | undefined, filters: SearchFilters, page: number): string {
  return `panel_search:${query || ""}:${JSON.stringify(filters)}:${page}`
}

function calculateTimeframeDate(timeframe: Timeframe): Date | null {
  if (timeframe === "all") return null
  const ms = TIMEFRAME_MS[timeframe]
  return ms ? new Date(Date.now() - ms) : null
}

function createEmptyResult(page: number, startTime: number, rateLimited = false): SearchResult {
  return {
    notes: [],
    totalCount: 0,
    page,
    hasMore: false,
    searchDuration: Date.now() - startTime,
    rateLimited,
  }
}

function buildUsersMap(users: UserInfo[] | null): Record<string, UserInfo> {
  return (users || []).reduce(
    (acc, user) => {
      acc[user.id] = user
      return acc
    },
    {} as Record<string, UserInfo>,
  )
}

function filterNotesByTags(notes: any[], tags: string[]): any[] {
  const lowerTags = tags.map((t) => t.toLowerCase())
  return notes.filter((note) => {
    const noteTags = note.personal_sticks_tags?.map((t: any) => t.tag_title.toLowerCase()) || []
    return lowerTags.some((tag) => noteTags.includes(tag))
  })
}

function enrichNotes(notes: any[], usersMap: Record<string, UserInfo>): EnrichedNote[] {
  return notes.map((note) => ({
    ...note,
    user: usersMap[note.user_id] || null,
    reply_count: note.personal_sticks_replies?.length || 0,
    view_count: Math.floor(Math.random() * 100) + 10,
    like_count: Math.floor(Math.random() * 50),
    tags: note.personal_sticks_tags?.map((t: any) => t.tag_title) || [],
  }))
}

async function findMatchingUserIds(db: DatabaseClient, searchTerm: string): Promise<string[]> {
  if (searchTerm.length < MIN_USER_SEARCH_LENGTH) return []

  try {
    const escaped = escapeSearchTerm(searchTerm)
    const { data: users } = await db
      .from("users")
      .select("id")
      .or(`username.ilike.%${escaped}%,full_name.ilike.%${escaped}%`)
      .limit(USER_SEARCH_LIMIT)
    return users?.map((u) => u.id) || []
  } catch {
    console.warn("User search failed, continuing without user filter")
    return []
  }
}

async function fetchUsersForNotes(db: DatabaseClient, notes: any[]): Promise<Record<string, UserInfo>> {
  const userIds = [...new Set(notes?.map((note) => note.user_id).filter(Boolean))]
  if (userIds.length === 0) return {}

  try {
    const { data: users } = await db
      .from("users")
      .select("id, username, full_name, avatar_url")
      .in("id", userIds)
    return buildUsersMap(users as UserInfo[] | null)
  } catch {
    console.warn("Failed to fetch users, continuing without user data")
    return {}
  }
}

function applySearchFilter(query: any, searchTerm: string, matchingUserIds: string[]): any {
  const escaped = escapeSearchTerm(searchTerm)
  const baseFilter = `topic.ilike.%${escaped}%,content.ilike.%${escaped}%`

  if (matchingUserIds.length > 0) {
    return query.or(`${baseFilter},user_id.in.(${matchingUserIds.join(",")})`)
  }
  return query.or(baseFilter)
}

function applySortOrder(query: any, sortBy: SortOption): any {
  const ascending = sortBy === "oldest"
  return query.order("created_at", { ascending })
}

async function trackSearchAnalytics(
  userId: string,
  query: string,
  filters: SearchFilters,
  notes: EnrichedNote[],
  totalCount: number,
  page: number,
): Promise<void> {
  try {
    await SearchAnalytics.trackSearch({
      user_id: userId,
      query,
      filters,
      results_count: notes.length,
    })

    await SearchCache.set(query, { notes, totalCount }, page)
  } catch {
    // Ignore analytics errors
  }
}

// Route handlers
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    let body: SearchInput
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return NextResponse.json(
        { error: "Rate limit exceeded", ...createEmptyResult(1, startTime, true) },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    const db = await createServiceDatabaseClient()
    const { query, filters = {}, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = body
    const { tags, timeframe, colors, sortBy = DEFAULT_SORT } = filters

    // Check cache
    const cacheKey = buildCacheKey(query, filters, page)
    const cachedResult = await SearchCache.get(cacheKey)
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        searchDuration: Date.now() - startTime,
      })
    }

    // Build base query
    let notesQuery = db
      .from("personal_sticks")
      .select(NOTES_SELECT_QUERY, { count: "exact" })
      .eq("is_shared", true)

    // Apply full-text search
    if (query?.trim()) {
      const searchTerm = query.trim()
      const matchingUserIds = await findMatchingUserIds(db, searchTerm)
      notesQuery = applySearchFilter(notesQuery, searchTerm, matchingUserIds)
    }

    // Apply timeframe filter
    const startDate = timeframe ? calculateTimeframeDate(timeframe) : null
    if (startDate) {
      notesQuery = notesQuery.gte("created_at", startDate.toISOString())
    }

    // Apply color filter
    if (colors?.length) {
      notesQuery = notesQuery.in("color", colors)
    }

    // Apply sort and pagination
    notesQuery = applySortOrder(notesQuery, sortBy)
    const offset = (page - 1) * limit
    notesQuery = notesQuery.range(offset, offset + limit - 1)

    // Execute query
    const { data: notes, error: notesError, count } = await notesQuery

    if (notesError) {
      console.error("Error in panel search:", notesError.message)
      if (notesError.message?.includes("Too Many") || notesError.code === "PGRST") {
        return NextResponse.json(createEmptyResult(page, startTime, true))
      }
      return NextResponse.json({ error: "Search failed", details: notesError.message }, { status: 500 })
    }

    // Fetch user data and enrich notes
    const usersMap = await fetchUsersForNotes(db, notes || [])
    let filteredNotes = notes || []

    // Apply tag filter (client-side for joined data)
    if (tags?.length) {
      filteredNotes = filterNotesByTags(filteredNotes, tags)
    }

    const enrichedNotes = enrichNotes(filteredNotes, usersMap)
    const totalCount = count || 0
    const hasMore = totalCount > offset + enrichedNotes.length

    // Track analytics for authenticated users
    if (user && query?.trim()) {
      await trackSearchAnalytics(user.id, query.trim(), filters, enrichedNotes, totalCount, page)
    }

    return NextResponse.json({
      notes: enrichedNotes,
      totalCount,
      page,
      hasMore,
      searchDuration: Date.now() - startTime,
    })
  } catch (error) {
    console.error("Error in panel search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await createServiceDatabaseClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    const suggestions: Suggestions = {
      recent: [],
      trending: [],
      tags: [],
    }

    // Get recent searches
    if (type === "all" || type === "recent") {
      const { data: recentSearches } = await db
        .from("search_history")
        .select("query")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(RECENT_SEARCH_LIMIT)

      const queries = recentSearches?.map((s: any) => s.query as string) || []
      suggestions.recent = Array.from(new Set(queries))
    }

    // Get trending tags from materialized view
    if (type === "all" || type === "trending") {
      const { data: trendingTags } = await db
        .from("trending_tags")
        .select("tag, usage_count")
        .limit(TRENDING_TAGS_LIMIT)

      suggestions.trending = trendingTags?.map((t: any) => t.tag as string) || []
    }

    // Get all available tags for filtering
    if (type === "all" || type === "tags") {
      const { data: allTags } = await db
        .from("personal_sticks_tags")
        .select("tag_title")
        .order("created_at", { ascending: false })
        .limit(ALL_TAGS_LIMIT)

      const tagTitles = allTags?.map((t: any) => t.tag_title as string) || []
      suggestions.tags = Array.from(new Set(tagTitles))
    }

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("Error fetching suggestions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

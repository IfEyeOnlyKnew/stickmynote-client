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

interface UserInfo {
  id: string
  username: string
  full_name: string
  avatar_url: string
}

interface ReplyUser {
  username?: string
  email?: string
}

interface ReplyData {
  id: string
  content: string
  color?: string
  created_at: string
  updated_at?: string
  user_id?: string
  personal_stick_id: string
  parent_reply_id?: string | null
  user?: ReplyUser
}

interface EnrichedNote {
  user: UserInfo | null
  reply_count: number
  replies: ReplyData[]
  view_count: number
  like_count: number
  tags: string[]
  [key: string]: any
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

const NOTES_SELECT_QUERY = `*`

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

function filterNotesByTags(notes: any[], tags: string[], tagsMap: Record<string, string[]>): any[] {
  const lowerTags = tags.map((t) => t.toLowerCase())
  return notes.filter((note) => {
    const noteTags = (tagsMap[note.id] || []).map((t: string) => t.toLowerCase())
    return lowerTags.some((tag) => noteTags.includes(tag))
  })
}

interface RepliesResult {
  counts: Record<string, number>
  replies: Record<string, ReplyData[]>
}

async function fetchRepliesForNotes(db: DatabaseClient, noteIds: string[]): Promise<RepliesResult> {
  if (noteIds.length === 0) return { counts: {}, replies: {} }

  try {
    const { data: replies } = await db
      .from("personal_sticks_replies")
      .select("id, content, color, created_at, updated_at, user_id, personal_stick_id, parent_reply_id")
      .in("personal_stick_id", noteIds)
      .order("created_at", { ascending: true })

    if (!replies || replies.length === 0) {
      return { counts: {}, replies: {} }
    }

    // Get unique user IDs from replies
    const replyUserIds = [...new Set(replies.map((r) => r.user_id).filter(Boolean))]

    // Fetch user data for reply authors
    let usersMap: Record<string, ReplyUser> = {}
    if (replyUserIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, username, email")
        .in("id", replyUserIds)

      usersMap = (users || []).reduce((acc, user) => {
        acc[user.id] = { username: user.username, email: user.email }
        return acc
      }, {} as Record<string, ReplyUser>)
    }

    const counts: Record<string, number> = {}
    const repliesMap: Record<string, ReplyData[]> = {}

    for (const reply of replies) {
      const noteId = reply.personal_stick_id
      counts[noteId] = (counts[noteId] || 0) + 1
      if (!repliesMap[noteId]) {
        repliesMap[noteId] = []
      }
      // Attach user data to each reply
      const replyWithUser: ReplyData = {
        ...reply,
        user: reply.user_id ? usersMap[reply.user_id] : undefined,
      }
      repliesMap[noteId].push(replyWithUser)
    }
    return { counts, replies: repliesMap }
  } catch (err) {
    console.warn("Failed to fetch replies:", err)
    return { counts: {}, replies: {} }
  }
}

async function fetchTagsForNotes(db: DatabaseClient, noteIds: string[]): Promise<Record<string, string[]>> {
  if (noteIds.length === 0) return {}

  try {
    const { data: tags } = await db
      .from("personal_sticks_tags")
      .select("personal_stick_id, tag_title")
      .in("personal_stick_id", noteIds)

    const tagsMap: Record<string, string[]> = {}
    for (const tag of tags || []) {
      if (!tagsMap[tag.personal_stick_id]) {
        tagsMap[tag.personal_stick_id] = []
      }
      tagsMap[tag.personal_stick_id].push(tag.tag_title)
    }
    return tagsMap
  } catch {
    console.warn("Failed to fetch tags")
    return {}
  }
}

function enrichNotes(
  notes: any[],
  usersMap: Record<string, UserInfo>,
  repliesResult: RepliesResult,
  tagsMap: Record<string, string[]>
): EnrichedNote[] {
  return notes.map((note) => ({
    ...note,
    user: usersMap[note.user_id] || null,
    reply_count: repliesResult.counts[note.id] || 0,
    replies: repliesResult.replies[note.id] || [],
    view_count: Math.floor(Math.random() * 100) + 10,
    like_count: Math.floor(Math.random() * 50),
    tags: tagsMap[note.id] || [],
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

    // Get note IDs for fetching related data
    const noteIds = (notes || []).map((n: any) => n.id)

    // Fetch user data, replies, and tags in parallel
    const [usersMap, repliesResult, tagsMap] = await Promise.all([
      fetchUsersForNotes(db, notes || []),
      fetchRepliesForNotes(db, noteIds),
      fetchTagsForNotes(db, noteIds),
    ])

    let filteredNotes = notes || []

    // Apply tag filter
    if (tags?.length) {
      filteredNotes = filterNotesByTags(filteredNotes, tags, tagsMap)
    }

    const enrichedNotes = enrichNotes(filteredNotes, usersMap, repliesResult, tagsMap)
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

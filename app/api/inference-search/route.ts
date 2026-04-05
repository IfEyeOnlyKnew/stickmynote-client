import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { cache } from "@/lib/cache"

// Types
interface UserData {
  id: string
  full_name: string | null
  email: string
  username: string | null
  avatar_url: string | null
}

interface InferencePadData {
  id: string
  name: string
  is_public: boolean
  owner_id: string
}

interface StickData {
  id: string
  topic: string | null
  content: string
  color: string | null
  created_at: string
  updated_at: string | null
  social_pad_id: string
  user_id: string
  is_public: boolean
  social_pads: InferencePadData
  users: UserData | null
  reply_count?: number
}

interface RawStickData {
  id: string
  topic: string | null
  content: string
  color: string | null
  created_at: string
  updated_at: string | null
  social_pad_id: string
  user_id: string
  is_public: boolean
  social_pads: InferencePadData | InferencePadData[]
  users: UserData | UserData[] | null
}

interface SearchParams {
  query: string
  dateFrom: string | null
  dateTo: string | null
  visibility: string | null
  authorId: string | null
  padId: string | null
  includeReplies: boolean
  sortBy: string
  sortOrder: string
  limit: number
  offset: number
}

interface AuthorInfo {
  id: string
  name: string
  email: string
}

interface PadInfo {
  id: string
  name: string
}

// Constants
const RATE_LIMIT_HEADERS = { "Retry-After": "30" }

const STICKS_SELECT = `
  id, topic, content, color, created_at, updated_at,
  social_pad_id, user_id, is_public
`

const REPLIES_SELECT = `
  id, content, category, created_at, social_stick_id, user_id
`

// Error responses
const Errors = {
  rateLimit: () => NextResponse.json(
    { error: "Rate limited" },
    { status: 429, headers: RATE_LIMIT_HEADERS }
  ),
  unauthorized: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  serverError: (message = "Internal server error") => NextResponse.json({ error: message }, { status: 500 }),
} as const

// Helper functions
function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10)
  const rawOffset = Number.parseInt(searchParams.get("offset") || "0", 10)

  return {
    query: searchParams.get("q") || "",
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    visibility: searchParams.get("visibility"),
    authorId: searchParams.get("authorId"),
    padId: searchParams.get("padId"),
    includeReplies: searchParams.get("includeReplies") === "true",
    sortBy: searchParams.get("sortBy") || "created_at",
    sortOrder: searchParams.get("sortOrder") || "desc",
    limit: Math.min(Math.max(rawLimit, 1), 100),
    offset: Math.max(rawOffset, 0),
  }
}

function normalizeStick(stick: RawStickData, replyCount: number): StickData {
  return {
    ...stick,
    social_pads: Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads,
    users: Array.isArray(stick.users) ? stick.users[0] : stick.users,
    reply_count: replyCount,
  }
}

function getUserData(stick: StickData): UserData | null {
  return Array.isArray(stick.users) ? stick.users[0] : stick.users
}

function filterByQuery(sticks: StickData[], query: string): StickData[] {
  if (!query) return sticks

  const lowerQuery = query.toLowerCase()
  return sticks.filter((stick) => {
    const userData = getUserData(stick)
    return (
      stick.topic?.toLowerCase().includes(lowerQuery) ||
      stick.content?.toLowerCase().includes(lowerQuery) ||
      userData?.full_name?.toLowerCase().includes(lowerQuery) ||
      userData?.email?.toLowerCase().includes(lowerQuery)
    )
  })
}

function sortSticks(sticks: StickData[], sortBy: string, sortOrder: string): StickData[] {
  const sorted = [...sticks]
  const multiplier = sortOrder === "desc" ? 1 : -1

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "replies":
        return multiplier * ((b.reply_count || 0) - (a.reply_count || 0))
      case "updated_at":
        return multiplier * (
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
        )
      case "created_at":
      default:
        return multiplier * (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    }
  })

  return sorted
}

function extractAuthors(sticks: StickData[]): AuthorInfo[] {
  const authorsMap = new Map<string, AuthorInfo>()

  for (const stick of sticks) {
    if (!authorsMap.has(stick.user_id)) {
      const userData = getUserData(stick)
      authorsMap.set(stick.user_id, {
        id: stick.user_id,
        name: userData?.full_name || userData?.email || "Unknown",
        email: userData?.email || "",
      })
    }
  }

  return Array.from(authorsMap.values())
}

function extractPads(sticks: StickData[]): PadInfo[] {
  const padsMap = new Map<string, PadInfo>()

  for (const stick of sticks) {
    if (!padsMap.has(stick.social_pad_id)) {
      padsMap.set(stick.social_pad_id, {
        id: stick.social_pad_id,
        name: stick.social_pads?.name || "Unknown",
      })
    }
  }

  return Array.from(padsMap.values())
}

function buildReplyCountMap(replyCounts: { social_stick_id: string }[] | null): Record<string, number> {
  const map: Record<string, number> = {}
  replyCounts?.forEach((reply) => {
    map[reply.social_stick_id] = (map[reply.social_stick_id] || 0) + 1
  })
  return map
}

// ============================================================================
// Database Operations
// ============================================================================

async function fetchAccessiblePadIds(
  db: DatabaseClient,
  userId: string,
  orgId: string
): Promise<string[]> {
  const { data } = await db
    .from("social_pad_members")
    .select("social_pad_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)

  return data?.map((p) => p.social_pad_id) || []
}

function applyFilters(
  query: any,
  params: SearchParams
): any {
  let q = query

  if (params.authorId) {
    q = q.eq("user_id", params.authorId)
  }

  if (params.padId) {
    q = q.eq("social_pad_id", params.padId)
  }

  if (params.dateFrom) {
    q = q.gte("created_at", params.dateFrom)
  }

  if (params.dateTo) {
    q = q.lte("created_at", params.dateTo)
  }

  return q
}

async function fetchReplyCounts(
  db: DatabaseClient,
  stickIds: string[],
  orgId: string
): Promise<Record<string, number>> {
  if (stickIds.length === 0) {
    return {}
  }

  const { data } = await db
    .from("social_stick_replies")
    .select("social_stick_id")
    .in("social_stick_id", stickIds)
    .eq("org_id", orgId)

  return buildReplyCountMap(data)
}


// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const db = await createDatabaseClient()

  // Auth check
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return Errors.rateLimit()
  }
  if (!authResult.user) {
    return Errors.unauthorized()
  }

  const user = authResult.user
  const orgContext = await getOrgContext()
  if (!orgContext) {
    return Errors.noOrgContext()
  }

  const params = parseSearchParams(request.nextUrl.searchParams)

  try {
    // Get user's accessible pads
    const padIds = await fetchAccessiblePadIds(db, user.id, orgContext.orgId)

    // Get all accessible social pads (public + owned + member)
    const { data: accessiblePads } = await db
      .from("social_pads")
      .select("id, name, is_public, owner_id")
      .eq("org_id", orgContext.orgId)
      .or("is_public.eq.true,owner_id.eq." + user.id + (padIds.length > 0 ? ",id.in.(" + padIds.join(",") + ")" : ""))

    const padMap: Record<string, InferencePadData> = {}
    const accessiblePadIds: string[] = []
    for (const pad of accessiblePads || []) {
      padMap[pad.id] = pad
      accessiblePadIds.push(pad.id)
    }

    const emptyResponse = {
      sticks: [],
      replies: [],
      metadata: { totalSticks: 0, totalReplies: 0, total: 0, hasMore: false, authors: [], pads: [] },
    }

    if (accessiblePadIds.length === 0) {
      return NextResponse.json(emptyResponse)
    }

    // Check cache
    const cacheKey = `social-search:${orgContext.orgId}:${user.id}:${JSON.stringify({
      q: params.query, dateFrom: params.dateFrom, dateTo: params.dateTo,
      visibility: params.visibility, authorId: params.authorId, padId: params.padId,
      includeReplies: params.includeReplies, sortBy: params.sortBy, sortOrder: params.sortOrder,
      limit: params.limit, offset: params.offset,
    })}`
    const cached = cache.get<typeof emptyResponse>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60", "X-Cache": "HIT" },
      })
    }

    // Build sticks query with SQL-level text filter
    let sticksQuery = db
      .from("social_sticks")
      .select(STICKS_SELECT, { count: "exact" })
      .eq("org_id", orgContext.orgId)
      .in("social_pad_id", accessiblePadIds)

    // Apply text search in SQL (uses trigram indexes)
    if (params.query) {
      sticksQuery = sticksQuery.or(
        `topic.ilike.%${params.query}%,content.ilike.%${params.query}%`
      )
    }

    sticksQuery = applyFilters(sticksQuery, params)

    // Apply SQL-level sort for created_at / updated_at
    const sortAscending = params.sortOrder === "asc"
    if (params.sortBy === "updated_at") {
      sticksQuery = sticksQuery.order("updated_at", { ascending: sortAscending, nullsFirst: false })
    } else {
      sticksQuery = sticksQuery.order("created_at", { ascending: sortAscending })
    }

    // Apply pagination (skip for "replies" sort — need all results for reply-count sorting)
    const needsJsSort = params.sortBy === "replies"
    if (!needsJsSort) {
      sticksQuery = sticksQuery.range(params.offset, params.offset + params.limit - 1)
    }

    const { data: sticks, error: sticksError, count: totalCount } = await sticksQuery

    if (sticksError) {
      console.error("[SocialSearch] Error fetching sticks:", sticksError)
      return Errors.serverError(sticksError.message)
    }

    // Fetch users for sticks
    const userIds = [...new Set((sticks || []).map((s: any) => s.user_id).filter(Boolean))]
    let userMap: Record<string, UserData> = {}
    if (userIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, full_name, email, username, avatar_url")
        .in("id", userIds)

      if (users) {
        userMap = Object.fromEntries(users.map((u: any) => [u.id, u]))
      }
    }

    // Get reply counts
    const stickIds = sticks?.map((s: any) => s.id) || []
    const replyCountMap = await fetchReplyCounts(db, stickIds, orgContext.orgId)

    // Normalize and process sticks — attach pad and user data
    let processedSticks: StickData[] = (sticks || []).map((stick: any) => ({
      ...stick,
      social_pads: padMap[stick.social_pad_id] || null,
      users: userMap[stick.user_id] || null,
      reply_count: replyCountMap[stick.id] || 0,
    }))

    // For "replies" sort: sort in JS then slice for pagination
    let total = totalCount || 0
    if (needsJsSort) {
      processedSticks = sortSticks(processedSticks, params.sortBy, params.sortOrder)
      total = processedSticks.length
      processedSticks = processedSticks.slice(params.offset, params.offset + params.limit)
    }

    // Search replies if requested
    let replyResults: unknown[] = []
    if (params.includeReplies && params.query) {
      const { data: replies } = await db
        .from("social_stick_replies")
        .select(REPLIES_SELECT)
        .ilike("content", `%${params.query}%`)
        .eq("org_id", orgContext.orgId)
        .limit(params.limit)

      // Fetch sticks for replies to check accessibility
      const replyStickIds = [...new Set((replies || []).map((r: any) => r.social_stick_id).filter(Boolean))]
      let replyStickMap: Record<string, { social_pad_id: string }> = {}

      if (replyStickIds.length > 0) {
        const { data: replySticks } = await db
          .from("social_sticks")
          .select("id, social_pad_id")
          .in("id", replyStickIds)

        if (replySticks) {
          replyStickMap = Object.fromEntries(replySticks.map((s: any) => [s.id, { social_pad_id: s.social_pad_id }]))
        }
      }

      // Filter replies by accessible pads and attach user data
      const replyUserIds = [...new Set((replies || []).map((r: any) => r.user_id).filter(Boolean))]
      let replyUserMap: Record<string, UserData> = {}
      if (replyUserIds.length > 0) {
        const { data: replyUsers } = await db
          .from("users")
          .select("id, full_name, email, username, avatar_url")
          .in("id", replyUserIds)

        if (replyUsers) {
          replyUserMap = Object.fromEntries(replyUsers.map((u: any) => [u.id, u]))
        }
      }

      replyResults = (replies || [])
        .filter((reply: any) => {
          const stick = replyStickMap[reply.social_stick_id]
          return stick && accessiblePadIds.includes(stick.social_pad_id)
        })
        .map((reply: any) => ({
          ...reply,
          users: replyUserMap[reply.user_id] || null,
        }))
    }

    // Extract metadata
    const authors = extractAuthors(processedSticks)
    const padsInfo = extractPads(processedSticks)
    const hasMore = total > params.offset + params.limit

    const result = {
      sticks: processedSticks,
      replies: replyResults,
      metadata: {
        totalSticks: processedSticks.length,
        totalReplies: replyResults.length,
        total,
        hasMore,
        authors,
        pads: padsInfo,
      },
    }

    // Cache for 1 minute
    cache.set(cacheKey, result, 60_000)

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60", "X-Cache": "MISS" },
    })
  } catch (error) {
    console.error("[SocialSearch] Search error:", error)
    return Errors.serverError()
  }
}

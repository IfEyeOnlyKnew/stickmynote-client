import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Types
interface UserData {
  id: string
  full_name: string | null
  email: string
  username: string | null
  avatar_url: string | null
}

interface SocialPadData {
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
  social_pads: SocialPadData
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
  social_pads: SocialPadData | SocialPadData[]
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
  social_pad_id, user_id, is_public,
  social_pads!inner(id, name, is_public, owner_id),
  users(id, full_name, email, username, avatar_url)
`

const REPLIES_SELECT = `
  id, content, category, created_at, social_stick_id, user_id,
  users(id, full_name, email, username, avatar_url),
  social_sticks!inner(id, topic, social_pad_id, social_pads(id, name, is_public))
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

function buildVisibilityClause(userId: string, padIds: string[]): string {
  const baseClauses = [
    `social_pads.is_public.eq.true`,
    `social_pads.owner_id.eq.${userId}`,
  ]

  if (padIds.length > 0) {
    baseClauses.push(`social_pad_id.in.(${padIds.join(",")})`)
  }

  return baseClauses.join(",")
}

function applyFilters(
  query: any,
  params: SearchParams
): any {
  let q = query

  if (params.visibility === "public") {
    q = q.eq("social_pads.is_public", true)
  } else if (params.visibility === "private") {
    q = q.eq("social_pads.is_public", false)
  }

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

interface ReplyWithStick {
  social_sticks?: {
    social_pads?: { is_public?: boolean }
    social_pad_id?: string
  }
}

function isReplyAccessible(reply: ReplyWithStick, padIds: string[]): boolean {
  const padIsPublic = reply.social_sticks?.social_pads?.is_public === true
  const replyPadId = reply.social_sticks?.social_pad_id || ""
  const isInMemberPads = padIds.includes(replyPadId)
  return padIsPublic || isInMemberPads
}

async function searchReplies(
  db: DatabaseClient,
  query: string,
  orgId: string,
  padIds: string[]
): Promise<unknown[]> {
  if (!query) {
    return []
  }

  const { data: replies } = await db
    .from("social_stick_replies")
    .select(REPLIES_SELECT)
    .ilike("content", `%${query}%`)
    .eq("org_id", orgId)

  return (replies || []).filter((reply: ReplyWithStick) =>
    isReplyAccessible(reply, padIds)
  )
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
  const orgContext = await getOrgContext(user.id)
  if (!orgContext) {
    return Errors.noOrgContext()
  }

  const params = parseSearchParams(request.nextUrl.searchParams)

  try {
    // Get user's accessible pads
    const padIds = await fetchAccessiblePadIds(db, user.id, orgContext.orgId)

    // Build and execute sticks query
    const visibilityClause = buildVisibilityClause(user.id, padIds)
    let sticksQuery = db
      .from("social_sticks")
      .select(STICKS_SELECT)
      .eq("org_id", orgContext.orgId)
      .or(visibilityClause)

    sticksQuery = applyFilters(sticksQuery, params)

    const { data: sticks, error: sticksError } = await sticksQuery

    if (sticksError) {
      console.error("[SocialSearch] Error fetching sticks:", sticksError)
      return Errors.serverError(sticksError.message)
    }

    // Get reply counts
    const stickIds = sticks?.map((s) => s.id) || []
    const replyCountMap = await fetchReplyCounts(db, stickIds, orgContext.orgId)

    // Normalize and process sticks
    let processedSticks = ((sticks || []) as RawStickData[]).map((stick) =>
      normalizeStick(stick, replyCountMap[stick.id] || 0)
    )

    // Apply text search filter
    processedSticks = filterByQuery(processedSticks, params.query)

    // Search replies if requested
    const replyResults = params.includeReplies
      ? await searchReplies(db, params.query, orgContext.orgId, padIds)
      : []

    // Sort results
    processedSticks = sortSticks(processedSticks, params.sortBy, params.sortOrder)

    // Extract metadata
    const authors = extractAuthors(processedSticks)
    const pads = extractPads(processedSticks)

    return NextResponse.json({
      sticks: processedSticks,
      replies: replyResults,
      metadata: {
        totalSticks: processedSticks.length,
        totalReplies: replyResults.length,
        authors,
        pads,
      },
    })
  } catch (error) {
    console.error("[SocialSearch] Search error:", error)
    return Errors.serverError()
  }
}

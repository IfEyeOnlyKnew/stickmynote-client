import { createDatabaseClient, createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { APICache, withCache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"
import type { OrgContext } from "@/lib/auth/get-org-context"

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

interface InferenceStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  org_id: string
  color: string
  created_at: string
  updated_at: string
  social_pads?: InferencePad | null
}

interface InferencePad {
  id: string
  name: string
  is_public?: boolean
  owner_id?: string
  org_id?: string
}

interface EnrichedStick extends InferenceStick {
  users: User | null
  reply_count: number
}

interface ReplyCount {
  social_stick_id: string
}

interface PadId {
  id: string
}

interface MemberPadId {
  social_pad_id: string
}


// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[InferenceSticks]"
const ADMIN_EMAILS = new Set(["chrisdoran63@outlook.com"])
const DEFAULT_STICK_COLOR = "#fef3c7"

const CACHE_TTL_SHORT = 30
const CACHE_TTL_MEDIUM = 60
const CACHE_STALE_SHORT = 60
const CACHE_STALE_LONG = 300

// Simple column selection - PostgreSQL adapter doesn't support Supabase-style joins
const STICK_SELECT_FIELDS = "*"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimit: () =>
    NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": "5" } }
    ),
  unauthorized: (details?: string) =>
    NextResponse.json(
      { error: "Unauthorized", details: details || "Authentication required" },
      { status: 401 }
    ),
  noOrgContext: () =>
    NextResponse.json({ error: "No organization context" }, { status: 403 }),
  forbidden: () =>
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  noAccess: () =>
    NextResponse.json({ error: "You don't have access to this pad" }, { status: 403 }),
  missingFields: () =>
    NextResponse.json({ error: "Topic and pad are required" }, { status: 400 }),
  fetchFailed: () =>
    NextResponse.json({ error: "Failed to fetch social sticks" }, { status: 500 }),
  createFailed: () =>
    NextResponse.json({ error: "Failed to create social stick" }, { status: 500 }),
} as const

// ============================================================================
// Helpers
// ============================================================================

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message
  return message.includes("Too Many") || message.includes("429") || message.includes("RATE_LIMITED")
}

function parseQueryParams(request: Request): {
  isPublic: boolean
  isAdmin: boolean
  isPrivate: boolean
  cacheInvalidation: string | null
  limit: number
  offset: number
  userId: string | null
} {
  const { searchParams } = new URL(request.url)
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10)
  const rawOffset = Number.parseInt(searchParams.get("offset") || "0", 10)
  return {
    isPublic: searchParams.get("public") === "true",
    isAdmin: searchParams.get("admin") === "true",
    isPrivate: searchParams.get("private") === "true",
    cacheInvalidation: searchParams.get("_t"),
    limit: Math.min(Math.max(rawLimit, 1), 100),
    offset: Math.max(rawOffset, 0),
    userId: searchParams.get("userId"),
  }
}

// ============================================================================
// Database Operations
// ============================================================================

async function fetchUsersByIds(
  db: DatabaseClient,
  userIds: string[]
): Promise<Map<string, User>> {
  if (userIds.length === 0) return new Map()

  const { data: users, error } = await db
    .from("users")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds)

  if (error) {
    console.error(`${LOG_PREFIX} Error fetching users:`, error)
    return new Map()
  }

  return new Map((users as User[] || []).map((u) => [u.id, u]))
}

async function fetchReplyCounts(
  db: DatabaseClient,
  stickIds: string[]
): Promise<Map<string, number>> {
  if (stickIds.length === 0) return new Map()

  const { data: replyCounts, error } = await db
    .from("social_stick_replies")
    .select("social_stick_id")
    .in("social_stick_id", stickIds)

  if (error) {
    console.error(`${LOG_PREFIX} Error fetching reply counts:`, error)
    return new Map()
  }

  const countMap = new Map<string, number>()
  for (const reply of (replyCounts as ReplyCount[] || [])) {
    countMap.set(reply.social_stick_id, (countMap.get(reply.social_stick_id) || 0) + 1)
  }

  return countMap
}

async function enrichSticksWithData(
  db: DatabaseClient,
  serviceDb: DatabaseClient,
  sticks: InferenceStick[]
): Promise<EnrichedStick[]> {
  if (!sticks || sticks.length === 0) {
    return []
  }

  const userIds = [...new Set(sticks.map((stick) => stick.user_id).filter(Boolean))]
  const stickIds = sticks.map((stick) => stick.id)

  const [usersMap, replyCountMap] = await Promise.all([
    fetchUsersByIds(serviceDb, userIds),
    fetchReplyCounts(db, stickIds),
  ])

  return sticks.map((stick) => ({
    ...stick,
    users: stick.user_id ? usersMap.get(stick.user_id) || null : null,
    reply_count: replyCountMap.get(stick.id) || 0,
  }))
}

async function fetchPublicSticks(
  db: DatabaseClient,
  options?: { limit?: number; offset?: number }
): Promise<InferenceStick[]> {
  // First get public pad IDs
  const publicPadIds = await fetchPublicPadIds(db)

  if (publicPadIds.length === 0) {
    return []
  }

  // Then fetch sticks for those pads
  let query = db
    .from("social_sticks")
    .select(STICK_SELECT_FIELDS)
    .in("social_pad_id", publicPadIds)
    .order("created_at", { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit + 1)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20))
  }

  const { data, error } = await query

  if (error) {
    console.error(`${LOG_PREFIX} Error fetching public sticks:`, error)
    throw error
  }

  return (data || []) as InferenceStick[]
}

async function fetchOwnedPadIds(
  db: DatabaseClient,
  userId: string,
  orgId: string,
  isPublicFilter?: boolean
): Promise<string[]> {
  let query = db
    .from("social_pads")
    .select("id")
    .eq("owner_id", userId)
    .eq("org_id", orgId)

  if (isPublicFilter !== undefined) {
    query = query.eq("is_public", isPublicFilter)
  }

  const { data } = await query
  return (data as PadId[] || []).map((p) => p.id)
}

async function fetchMemberPadIds(
  db: DatabaseClient,
  userId: string,
  orgId: string
): Promise<string[]> {
  const { data } = await db
    .from("social_pad_members")
    .select("social_pad_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("accepted", true)

  return (data as MemberPadId[] || []).map((m) => m.social_pad_id)
}

async function fetchPrivateMemberPadIds(
  db: DatabaseClient,
  memberPadIds: string[],
  orgId: string
): Promise<string[]> {
  if (memberPadIds.length === 0) return []

  const { data } = await db
    .from("social_pads")
    .select("id, is_public")
    .in("id", memberPadIds)
    .eq("org_id", orgId)
    .eq("is_public", false)

  return (data as PadId[] || []).map((p) => p.id)
}

async function fetchPublicPadIds(db: DatabaseClient): Promise<string[]> {
  const { data } = await db
    .from("social_pads")
    .select("id")
    .eq("is_public", true)

  return (data as PadId[] || []).map((p) => p.id)
}

async function fetchSticksByPadIds(
  db: DatabaseClient,
  padIds: string[],
  orgId?: string,
  options?: { limit?: number; offset?: number; userId?: string | null }
): Promise<InferenceStick[]> {
  if (padIds.length === 0) return []

  let query = db
    .from("social_sticks")
    .select(STICK_SELECT_FIELDS)
    .in("social_pad_id", padIds)
    .order("created_at", { ascending: false })

  if (orgId) {
    query = query.eq("org_id", orgId)
  }

  if (options?.userId) {
    query = query.eq("user_id", options.userId)
  }

  if (options?.limit) {
    // Fetch one extra to detect hasMore
    query = query.limit(options.limit + 1)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20))
  }

  const { data, error } = await query

  if (error) {
    console.error(`${LOG_PREFIX} Error fetching sticks:`, error)
    throw error
  }

  return (data || []) as InferenceStick[]
}

async function fetchAllSticks(db: DatabaseClient): Promise<InferenceStick[]> {
  const { data, error } = await db
    .from("social_sticks")
    .select(STICK_SELECT_FIELDS)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data || []) as InferenceStick[]
}

async function checkPadAccess(
  db: DatabaseClient,
  padId: string,
  userId: string,
  orgId: string
): Promise<{ hasAccess: boolean; pad: InferencePad | null }> {
  const { data: membership } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("accepted", true)
    .maybeSingle()

  const { data: pad } = await db
    .from("social_pads")
    .select("owner_id, org_id")
    .eq("id", padId)
    .maybeSingle()

  const hasAccess = Boolean(membership) || pad?.owner_id === userId

  return { hasAccess, pad: pad as InferencePad | null }
}

async function createStick(
  db: DatabaseClient,
  data: {
    topic: string
    content: string
    social_pad_id: string
    user_id: string
    org_id: string
    color: string
  }
): Promise<InferenceStick> {
  const { data: stick, error } = await db
    .from("social_sticks")
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return stick as InferenceStick
}

// ============================================================================
// GET Request Handlers
// ============================================================================

async function handlePublicSticksRequest(
  db: DatabaseClient,
  serviceDb: DatabaseClient,
  limit: number,
  offset: number
): Promise<Response> {
  const cacheKey = APICache.getCacheKey("social-sticks", { public: true, limit, offset })

  return withCache(
    cacheKey,
    async () => {
      const publicSticks = await fetchPublicSticks(db, { limit, offset })
      const hasMore = publicSticks.length > limit
      const pageSticks = hasMore ? publicSticks.slice(0, limit) : publicSticks
      const enrichedSticks = await enrichSticksWithData(db, serviceDb, pageSticks)
      return { sticks: enrichedSticks, hasMore }
    },
    { ttl: CACHE_TTL_MEDIUM, staleWhileRevalidate: CACHE_STALE_LONG }
  )
}

async function handlePrivateSticksRequest(
  db: DatabaseClient,
  serviceDb: DatabaseClient,
  user: { id: string; email?: string },
  orgContext: OrgContext,
  limit: number,
  offset: number
): Promise<Response> {
  const cacheKey = APICache.getCacheKey("social-sticks", {
    private: true,
    userId: user.id,
    orgId: orgContext.orgId,
    limit,
    offset,
  })

  return withCache(
    cacheKey,
    async () => {
      const [ownedPrivatePadIds, memberPadIds] = await Promise.all([
        fetchOwnedPadIds(db, user.id, orgContext.orgId, false),
        fetchMemberPadIds(db, user.id, orgContext.orgId),
      ])

      const memberPrivatePadIds = await fetchPrivateMemberPadIds(
        db,
        memberPadIds,
        orgContext.orgId
      )

      const privatePadIds = [...ownedPrivatePadIds, ...memberPrivatePadIds]

      if (privatePadIds.length === 0) {
        return { sticks: [], hasMore: false }
      }

      const privateSticks = await fetchSticksByPadIds(db, privatePadIds, orgContext.orgId, { limit, offset })
      const hasMore = privateSticks.length > limit
      const pageSticks = hasMore ? privateSticks.slice(0, limit) : privateSticks
      const enrichedSticks = await enrichSticksWithData(db, serviceDb, pageSticks)
      return { sticks: enrichedSticks, hasMore }
    },
    {
      ttl: CACHE_TTL_SHORT,
      staleWhileRevalidate: CACHE_STALE_SHORT,
      tags: [`social-sticks-${user.id}-${orgContext.orgId}`],
    }
  )
}

async function handleAdminSticksRequest(
  db: DatabaseClient,
  serviceDb: DatabaseClient,
  user: { id: string; email?: string }
): Promise<Response> {
  const isUserAdmin = user.email && ADMIN_EMAILS.has(user.email)
  if (!isUserAdmin) {
    return Errors.forbidden()
  }

  const allSticks = await fetchAllSticks(db)
  const enrichedSticks = await enrichSticksWithData(db, serviceDb, allSticks)
  return NextResponse.json({ sticks: enrichedSticks })
}

async function handleDefaultSticksRequest(
  db: DatabaseClient,
  serviceDb: DatabaseClient,
  user: { id: string; email?: string },
  orgContext: OrgContext,
  options: { cacheInvalidation: string | null; limit: number; offset: number; filterUserId: string | null }
): Promise<Response> {
  const { cacheInvalidation, limit, offset, filterUserId } = options
  const cacheKey = APICache.getCacheKey("social-sticks", {
    userId: user.id,
    orgId: orgContext.orgId,
    limit,
    offset,
    filterUserId: filterUserId || undefined,
  })

  if (cacheInvalidation) {
    await APICache.invalidate(cacheKey)
  }

  return withCache(
    cacheKey,
    async () => {
      const [ownedPadIds, memberPadIds, publicPadIds] = await Promise.all([
        fetchOwnedPadIds(db, user.id, orgContext.orgId),
        fetchMemberPadIds(db, user.id, orgContext.orgId),
        fetchPublicPadIds(db),
      ])

      const uniquePadIds = [...new Set([...ownedPadIds, ...memberPadIds, ...publicPadIds])]

      if (uniquePadIds.length === 0) {
        return { sticks: [], hasMore: false }
      }

      const sticks = await fetchSticksByPadIds(db, uniquePadIds, undefined, {
        limit,
        offset,
        userId: filterUserId,
      })
      const hasMore = sticks.length > limit
      const pageSticks = hasMore ? sticks.slice(0, limit) : sticks
      const enrichedSticks = await enrichSticksWithData(db, serviceDb, pageSticks)
      return { sticks: enrichedSticks, hasMore }
    },
    {
      ttl: CACHE_TTL_SHORT,
      staleWhileRevalidate: CACHE_STALE_SHORT,
      tags: [`social-sticks-${user.id}-${orgContext.orgId}`],
    }
  )
}

async function getOrgContextSafe(): Promise<OrgContext | null> {
  try {
    return await getOrgContext()
  } catch (orgError) {
    if (orgError instanceof Error && orgError.message === "RATE_LIMITED") {
      throw orgError
    }
    console.error(`${LOG_PREFIX} Error getting org context:`, orgError)
    return null
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

export async function GET(request: Request) {
  try {
    const { isPublic, isAdmin, isPrivate, cacheInvalidation, limit, offset, userId } = parseQueryParams(request)
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return Errors.rateLimit()
    }

    // Handle public sticks request (no auth required)
    if (isPublic) {
      return handlePublicSticksRequest(db, serviceDb, limit, offset)
    }

    // All other requests require authentication
    if (!user) {
      return Errors.unauthorized()
    }

    // Handle admin sticks request
    if (isAdmin) {
      return handleAdminSticksRequest(db, serviceDb, user)
    }

    // Get org context for private/default requests
    const orgContext = await getOrgContextSafe()

    // Handle private sticks request
    if (isPrivate) {
      if (!orgContext) {
        return Errors.unauthorized("No organization context")
      }
      return handlePrivateSticksRequest(db, serviceDb, user, orgContext, limit, offset)
    }

    // Handle default request - fallback to public if no org context
    if (!orgContext) {
      console.warn(`${LOG_PREFIX} No org context for user, falling back to public sticks only:`, user.email)
      const publicSticks = await fetchPublicSticks(db, { limit, offset })
      const hasMore = publicSticks.length > limit
      const pageSticks = hasMore ? publicSticks.slice(0, limit) : publicSticks
      const enrichedSticks = await enrichSticksWithData(db, serviceDb, pageSticks)
      return NextResponse.json({ sticks: enrichedSticks, hasMore })
    }

    return handleDefaultSticksRequest(db, serviceDb, user, orgContext, { cacheInvalidation, limit, offset, filterUserId: userId })
  } catch (error) {
    if (isRateLimitError(error)) {
      return Errors.rateLimit()
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return Errors.rateLimit()
    }
    console.error(`${LOG_PREFIX} GET error:`, error)
    return Errors.fetchFailed()
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return Errors.noOrgContext()
    }

    const { topic, content, social_pad_id, color } = await request.json()

    if (!topic?.trim() || !social_pad_id) {
      return Errors.missingFields()
    }

    // Check pad access
    const { hasAccess, pad } = await checkPadAccess(db, social_pad_id, user.id, orgContext.orgId)

    if (!hasAccess) {
      return Errors.noAccess()
    }

    // Create stick
    const stick = await createStick(db, {
      topic: topic.trim(),
      content: content?.trim() || "",
      social_pad_id,
      user_id: user.id,
      org_id: pad?.org_id || orgContext.orgId,
      color: color || DEFAULT_STICK_COLOR,
    })

    // Invalidate caches
    await Promise.all([
      APICache.invalidate(`social-sticks:userId=${user.id}:orgId=${orgContext.orgId}`),
      APICache.invalidate(`social-sticks:public=true`),
    ])

    // Broadcast real-time events to org
    const stickOrgId = pad?.org_id || orgContext.orgId
    publishToOrg(stickOrgId, {
      type: "social_activity.new",
      payload: { stickId: stick?.id, userId: user.id, activityType: "created" },
      timestamp: Date.now(),
    })
    publishToOrg(stickOrgId, {
      type: "inference_notification.new",
      payload: { stickId: stick?.id, userId: user.id, type: "stick_created" },
      timestamp: Date.now(),
    })

    return NextResponse.json({ stick })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.createFailed()
  }
}

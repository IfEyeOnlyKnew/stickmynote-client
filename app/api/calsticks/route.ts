import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { CalstickCache } from "@/lib/calstick-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// Helper: Parse query parameters from URL
function parseQueryParams(url: string) {
  const { searchParams } = new URL(url)
  const page = Number.parseInt(searchParams.get("page") || "1")
  const limit = Number.parseInt(searchParams.get("limit") || "50")
  return {
    filter: searchParams.get("filter") || "all",
    search: searchParams.get("search") || "",
    page,
    limit,
    padId: searchParams.get("padId") || "all",
    stickId: searchParams.get("stickId") || "",
    offset: (page - 1) * limit,
  }
}

// Helper: Apply filter to query based on filter type
function applyFilterToQuery(query: any, filter: string) {
  const filterMap: Record<string, () => any> = {
    completed: () => query.eq("calstick_completed", true),
    "not-completed": () => query.eq("calstick_completed", false),
    promoted: () => query.not("social_stick_id", "is", null),
  }
  return filterMap[filter]?.() || query
}

// Helper: Filter calsticks by user ownership
function filterByUserOwnership(calsticks: any[], userId: string) {
  return calsticks.filter(
    (cs: any) => cs.user_id === userId || cs.stick?.user_id === userId,
  )
}

// Helper: Filter calsticks by pad ID
function filterByPadId(calsticks: any[], padId: string) {
  if (!padId || padId === "all") return calsticks
  return calsticks.filter((cs: any) => cs.stick?.pad_id === padId)
}

// Helper: Search filter for calsticks
function filterBySearch(calsticks: any[], search: string) {
  if (!search) return calsticks
  const searchLower = search.toLowerCase()
  return calsticks.filter((cs: any) => {
    const contentMatch = cs.content?.toLowerCase().includes(searchLower)
    const topicMatch = cs.stick?.topic?.toLowerCase().includes(searchLower)
    return contentMatch || topicMatch
  })
}

// Helper: Fetch assignees and map to calsticks
async function attachAssignees(db: any, calsticks: any[]) {
  const assigneeIds = [...new Set(calsticks.map((cs: any) => cs.calstick_assignee_id).filter(Boolean))]
  
  if (assigneeIds.length === 0) {
    return calsticks.map((cs) => ({ ...cs, assignee: null }))
  }

  const { data: assignees } = await db
    .from("users")
    .select("id, username, full_name, email, avatar_url")
    .in("id", assigneeIds)

  const assigneeMap = Object.fromEntries((assignees || []).map((a: any) => [a.id, a]))
  
  return calsticks.map((cs: any) => ({
    ...cs,
    assignee: assigneeMap[cs.calstick_assignee_id] || null,
  }))
}

// Helper: Try to get cached response
async function getCachedResponse(cacheKey: string) {
  const cached = await CalstickCache.get<any>(cacheKey)
  if (!cached) return null
  
  const response = NextResponse.json(cached.data)
  response.headers.set("X-Cache", "HIT")
  response.headers.set("X-Cache-Age", String(Date.now() - cached.timestamp))
  return response
}

// Helper: Build base query for calsticks (without nested joins for PostgreSQL adapter)
function buildBaseQuery(db: any, orgId: string, offset: number, limit: number) {
  return db
    .from("paks_pad_stick_replies")
    .select(
      `
      id, stick_id, user_id, content, color, is_calstick,
      calstick_date, calstick_completed, calstick_completed_at,
      calstick_progress, calstick_status, calstick_priority,
      calstick_assignee_id, calstick_estimated_hours, calstick_actual_hours,
      calstick_start_date, social_stick_id, sprint_id, story_points,
      created_at, updated_at
    `,
      { count: "exact" },
    )
    .eq("is_calstick", true)
    .eq("org_id", orgId)
    .order("calstick_date", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)
}

// Helper: Fetch related user and stick data separately
async function attachRelatedData(db: any, calsticks: any[]) {
  if (!calsticks.length) return calsticks

  // Get unique user IDs and stick IDs
  const userIds = [...new Set(calsticks.map((cs: any) => cs.user_id).filter(Boolean))]
  const stickIds = [...new Set(calsticks.map((cs: any) => cs.stick_id).filter(Boolean))]

  // Fetch users
  const { data: users } = userIds.length > 0
    ? await db.from("users").select("id, username, full_name, email, avatar_url").in("id", userIds)
    : { data: [] }

  // Fetch sticks
  const { data: sticks } = stickIds.length > 0
    ? await db.from("paks_pad_sticks").select("id, topic, content, user_id, pad_id").in("id", stickIds)
    : { data: [] }

  // Fetch pads for the sticks
  const padIds = [...new Set((sticks || []).map((s: any) => s.pad_id).filter(Boolean))]
  const { data: pads } = padIds.length > 0
    ? await db.from("paks_pads").select("id, name, owner_id").in("id", padIds)
    : { data: [] }

  // Create lookup maps
  const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]))
  const padMap = Object.fromEntries((pads || []).map((p: any) => [p.id, p]))
  const stickMap = Object.fromEntries((sticks || []).map((s: any) => [s.id, { ...s, pad: padMap[s.pad_id] || null }]))

  // Attach related data to calsticks
  return calsticks.map((cs: any) => ({
    ...cs,
    user: userMap[cs.user_id] || null,
    stick: stickMap[cs.stick_id] || null,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

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
    const orgContext = await getOrgContext()
    
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const params = parseQueryParams(request.url)
    const { filter, search, page, limit, padId, stickId, offset } = params
    const shouldCache = !search && !stickId

    const cacheKey = CalstickCache.getUserCacheKey(user.id, { filter, page, limit, padId, orgId: orgContext.orgId })
    
    if (shouldCache) {
      const cachedResponse = await getCachedResponse(cacheKey)
      if (cachedResponse) return cachedResponse
    }

    let query = buildBaseQuery(db, orgContext.orgId, offset, limit)

    if (stickId) {
      query = query.eq("id", stickId)
    }

    query = applyFilterToQuery(query, filter)

    // Note: padId filtering is done in post-processing via filterByPadId since we're not joining tables

    const { data: allCalsticks, error, count } = await query

    if (error) {
      console.error("[calsticks] Query error:", error)
      return NextResponse.json({ error: "Failed to fetch CalSticks" }, { status: 500 })
    }

    // Attach related user and stick data
    const calsticksWithRelatedData = await attachRelatedData(db, allCalsticks || [])
    const userCalsticks = filterByUserOwnership(calsticksWithRelatedData, user.id)
    const padFilteredCalsticks = filterByPadId(userCalsticks, padId)
    const calsticksWithAssignees = await attachAssignees(db, padFilteredCalsticks)
    const finalCalsticks = filterBySearch(calsticksWithAssignees, search)

    const responseData = {
      calsticks: finalCalsticks,
      total: count,
      page,
      limit,
      hasMore: finalCalsticks.length >= limit,
    }

    if (shouldCache) {
      await CalstickCache.set(cacheKey, responseData)
    }

    const response = NextResponse.json(responseData)
    response.headers.set("X-Cache", "MISS")
    return response
  } catch (error) {
    console.error("[calsticks] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

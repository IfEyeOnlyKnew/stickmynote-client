import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { CalstickCache } from "@/lib/calstick-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
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

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get("filter") || "all"
    const search = searchParams.get("search") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const padId = searchParams.get("padId") || "all"
    const stickId = searchParams.get("stickId") || ""
    const offset = (page - 1) * limit

    const cacheKey = CalstickCache.getUserCacheKey(user.id, { filter, page, limit, padId, orgId: orgContext.orgId })
    if (!search && !stickId) {
      const cached = await CalstickCache.get<any>(cacheKey)
      if (cached) {
        const response = NextResponse.json(cached.data)
        response.headers.set("X-Cache", "HIT")
        response.headers.set("X-Cache-Age", String(Date.now() - cached.timestamp))
        return response
      }
    }

    let query = supabase
      .from("paks_pad_stick_replies")
      .select(
        `
        id,
        stick_id,
        user_id,
        content,
        color,
        is_calstick,
        calstick_date,
        calstick_completed,
        calstick_completed_at,
        calstick_progress,
        calstick_status,
        calstick_priority,
        calstick_assignee_id,
        calstick_estimated_hours,
        calstick_actual_hours,
        calstick_start_date,
        social_stick_id,
        created_at,
        updated_at,
        user:users!paks_pad_stick_replies_user_id_fkey(
          id,
          username,
          full_name,
          email,
          avatar_url
        ),
        stick:paks_pad_sticks(
          id,
          topic,
          content,
          user_id,
          pad_id,
          pad:paks_pads(
            id,
            name,
            owner_id
          )
        )
      `,
        { count: "exact" },
      )
      .eq("is_calstick", true)
      .eq("org_id", orgContext.orgId)
      .order("calstick_date", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (stickId) {
      query = query.eq("id", stickId)
    }

    if (filter === "completed") {
      query = query.eq("calstick_completed", true)
    } else if (filter === "not-completed") {
      query = query.eq("calstick_completed", false)
    } else if (filter === "promoted") {
      query = query.not("social_stick_id", "is", null)
    }

    if (padId && padId !== "all") {
      query = query.eq("paks_pad_sticks.pad_id", padId)
    }

    const { data: allCalsticks, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch CalSticks" }, { status: 500 })
    }

    let filteredCalsticks = (allCalsticks || []).filter(
      (calstick: any) => calstick.user_id === user.id || calstick.stick?.user_id === user.id,
    )

    if (padId && padId !== "all") {
      filteredCalsticks = filteredCalsticks.filter((cs: any) => cs.stick?.pad_id === padId)
    }

    const assigneeIds = [...new Set(filteredCalsticks.map((cs: any) => cs.calstick_assignee_id).filter(Boolean))]

    let assigneeMap: Record<string, any> = {}
    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabase
        .from("users")
        .select("id, username, full_name, email, avatar_url")
        .in("id", assigneeIds)

      if (assignees) {
        assigneeMap = Object.fromEntries(assignees.map((a) => [a.id, a]))
      }
    }

    const calsticsWithAssignees = filteredCalsticks.map((cs: any) => ({
      ...cs,
      assignee: cs.calstick_assignee_id ? assigneeMap[cs.calstick_assignee_id] || null : null,
    }))

    const searchFilteredCalsticks = search
      ? calsticsWithAssignees.filter((calstick: any) => {
          const searchLower = search.toLowerCase()
          const contentMatch = calstick.content?.toLowerCase().includes(searchLower)
          const topicMatch = calstick.stick?.topic?.toLowerCase().includes(searchLower)
          return contentMatch || topicMatch
        })
      : calsticsWithAssignees

    const responseData = {
      calsticks: searchFilteredCalsticks,
      total: count,
      page,
      limit,
      hasMore: searchFilteredCalsticks.length >= limit,
    }

    if (!search && !stickId) {
      await CalstickCache.set(cacheKey, responseData)
    }

    const response = NextResponse.json(responseData)
    response.headers.set("X-Cache", "MISS")
    return response
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

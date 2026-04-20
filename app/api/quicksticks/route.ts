import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { APICache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const db = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()

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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 100)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0"), 0)

    const cacheKey = APICache.getCacheKey("quicksticks", {
      userId: user.id,
      orgId: orgContext.orgId,
      search,
      limit,
      offset,
    })

    const cached = await APICache.get(cacheKey)
    if (cached && !APICache.isStale(cached.timestamp, 30)) {
      return APICache.createCachedResponse(cached.data, {
        ttl: 30,
        staleWhileRevalidate: 60,
      })
    }

    // Top-level quicksticks only. Sub-sticks of quickstick parents are
    // fetched separately below so they render inline alongside their parent.
    let query = db
      .from("paks_pad_sticks")
      .select("*", { count: "exact" })
      .eq("is_quickstick", true)
      .eq("org_id", orgContext.orgId)
      .is("parent_stick_id", null)
      .order("updated_at", { ascending: false })

    // Apply search filter if provided
    if (search) {
      query = query.or(`topic.ilike.%${search}%,content.ilike.%${search}%`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: sticks, error, count } = await query

    if (error) {
      console.error("Error fetching QuickSticks:", error)
      return NextResponse.json({ error: "Failed to fetch QuickSticks" }, { status: 500 })
    }

    // Fetch pads separately for the sticks
    const padIds = [...new Set((sticks || []).map((s: any) => s.pad_id).filter(Boolean))]
    let padMap: Record<string, { id: string; name: string; owner_id: string }> = {}

    if (padIds.length > 0) {
      const { data: pads } = await db
        .from("paks_pads")
        .select("id, name, owner_id")
        .in("id", padIds)
        .eq("org_id", orgContext.orgId)

      if (pads) {
        padMap = Object.fromEntries(pads.map((p: any) => [p.id, p]))
      }
    }

    // Attach pad data and filter sticks based on user permissions
    const accessibleSticks = (sticks || [])
      .map((stick: any) => ({
        ...stick,
        pads: padMap[stick.pad_id] || null,
      }))
      .filter((stick: any) => {
        const pad = stick.pads
        if (!pad) return false
        if (stick.user_id === user.id) return true
        if (pad.owner_id === user.id) return true
        return false
      })

    // Fetch sub-sticks of the accessible quickstick parents. Sub-sticks show
    // regardless of their own is_quickstick flag — they belong to the family.
    const parentIds = accessibleSticks.map((s: any) => s.id)
    let subSticks: any[] = []
    if (parentIds.length > 0) {
      const { data: subs } = await db
        .from("paks_pad_sticks")
        .select("*")
        .in("parent_stick_id", parentIds)
        .order("created_at", { ascending: false })
      subSticks = (subs || []).map((s: any) => ({
        ...s,
        pads: padMap[s.pad_id] || null,
      }))
    }

    const responseData = {
      sticks: accessibleSticks || [],
      subSticks,
      hasMore: (sticks?.length || 0) === limit,
      total: count || 0,
      offset,
      limit,
    }

    await APICache.set(cacheKey, responseData, {
      ttl: 30,
      tags: [`quicksticks-${user.id}-${orgContext.orgId}`],
    })

    return APICache.createCachedResponse(responseData, {
      ttl: 30,
      staleWhileRevalidate: 60,
    })
  } catch (err) {
    console.error("GET /api/quicksticks error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

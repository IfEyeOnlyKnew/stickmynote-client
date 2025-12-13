import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { APICache } from "@/lib/api-cache"
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

    let query = supabase
      .from("paks_pad_sticks")
      .select(
        `
        *,
        pads:paks_pads!inner(
          id,
          name,
          owner_id
        )
      `,
        { count: "exact" },
      )
      .eq("is_quickstick", true)
      .eq("org_id", orgContext.orgId)
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

    // Filter sticks based on user permissions
    const accessibleSticks = sticks?.filter((stick) => {
      const pad = stick.pads
      if (!pad) return false
      if (stick.user_id === user.id) return true
      if (pad.owner_id === user.id) return true
      return false
    })

    const responseData = {
      sticks: accessibleSticks || [],
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

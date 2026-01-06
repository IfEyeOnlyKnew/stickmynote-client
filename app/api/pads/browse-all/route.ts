import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse, type NextRequest } from "next/server"
import { APICache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

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
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 100)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0"), 0)

    const cacheKey = APICache.getCacheKey("pads/browse-all", {
      userId: user.id,
      orgId: orgContext.orgId,
      limit,
      offset,
    })
    const cached = await APICache.get(cacheKey)

    if (cached && !APICache.isStale(cached.timestamp, 60)) {
      return APICache.createCachedResponse(cached.data, {
        ttl: 60,
        staleWhileRevalidate: 300,
      })
    }

    const { count: totalCount } = await db
      .from("paks_pads")
      .select("*", { count: "exact", head: true })
      .is("multi_pak_id", null)
      .eq("org_id", orgContext.orgId)

    const { data: allPads, error: padsError } = await db
      .from("paks_pads")
      .select(`
        id,
        name,
        description,
        owner_id,
        created_at,
        multi_pak_id
      `)
      .is("multi_pak_id", null)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (padsError) {
      console.error("Error fetching all Pads:", padsError)
      return NextResponse.json({ error: "Failed to fetch Pads" }, { status: 500 })
    }

    const { data: userMemberships, error: membershipsError } = await db
      .from("paks_pad_members")
      .select("pad_id, role")
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)

    if (membershipsError) {
      console.error("[v0] Error fetching user memberships:", membershipsError)
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 })
    }

    const userPadIds = new Set(userMemberships?.map((m) => m.pad_id) || [])

    const { data: accessRequests, error: requestsError } = await db
      .from("paks_pad_access_requests")
      .select("pad_id, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .eq("org_id", orgContext.orgId)

    if (requestsError) {
      console.error("[v0] Error fetching access requests:", requestsError)
    }

    const pendingRequestIds = new Set(accessRequests?.map((r) => r.pad_id) || [])

    const processedPads = allPads?.map((pad) => {
      const isOwner = pad.owner_id === user.id
      const hasAccess = isOwner || userPadIds.has(pad.id)
      const hasPendingRequest = pendingRequestIds.has(pad.id)
      const userRole = isOwner ? "owner" : userMemberships?.find((m) => m.pad_id === pad.id)?.role

      return {
        ...pad,
        hasAccess,
        hasPendingRequest,
        userRole: hasAccess ? userRole : null,
      }
    })

    const responseData = {
      pads: processedPads,
      hasMore: (allPads?.length || 0) === limit,
      total: totalCount || 0,
      offset,
      limit,
    }

    await APICache.set(cacheKey, responseData, {
      ttl: 60,
      tags: [`pads-${user.id}-${orgContext.orgId}`],
    })

    return APICache.createCachedResponse(responseData, {
      ttl: 60,
      staleWhileRevalidate: 300,
    })
  } catch (error) {
    console.error("Error in browse-all Pads route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

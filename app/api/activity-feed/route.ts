import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// GET /api/activity-feed - Fetch user's activity feed
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
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
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const activityType = searchParams.get("type")

    const { data: activities, error } = await supabase.rpc("get_user_activity_feed", {
      p_user_id: user.id,
      p_limit: limit,
      p_offset: offset,
      p_org_id: orgContext.orgId,
    })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch activity feed" }, { status: 500 })
    }

    // Filter by activity type if specified
    let filteredActivities = activities || []
    if (activityType) {
      filteredActivities = filteredActivities.filter((a: any) => a.activity_type === activityType)
    }

    return NextResponse.json({
      activities: filteredActivities,
      hasMore: filteredActivities.length === limit,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

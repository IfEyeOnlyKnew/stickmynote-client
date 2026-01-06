import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"

// GET /api/activity-feed - Fetch user's activity feed
export async function GET(request: Request) {
  try {
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
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const activityType = searchParams.get("type")

    // Fetch activity feed from PostgreSQL
    let query = `
      SELECT * FROM user_activity_feed 
      WHERE user_id = $1 AND org_id = $2
    `
    const params: unknown[] = [user.id, orgContext.orgId]
    
    if (activityType) {
      query += ` AND activity_type = $3`
      params.push(activityType)
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)
    const activities = result.rows || []

    return NextResponse.json({
      activities,
      hasMore: activities.length === limit,
    })
  } catch (error_) {
    console.error("Activity feed error:", error_)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

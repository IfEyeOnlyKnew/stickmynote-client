import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgBadges, getUserBadges, createBadge } from "@/lib/recognition/badges"

// GET /api/recognition/badges - Get badges (org badges or user badges)
export async function GET(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const includeInactive = searchParams.get("includeInactive") === "true"

    if (userId) {
      const badges = await getUserBadges(userId, orgContext.orgId)
      return NextResponse.json({ badges })
    }

    const badges = await getOrgBadges(orgContext.orgId, !includeInactive)
    return NextResponse.json({ badges })
  } catch (error) {
    console.error("Error fetching badges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/recognition/badges - Create a new badge (admin only)
export async function POST(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    // Admin-only check
    if (orgContext.role !== "owner" && orgContext.role !== "admin") {
      return NextResponse.json({ error: "Only admins can create badges" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, icon, color, tier, category, criteriaType, criteriaThreshold } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Badge name is required" }, { status: 400 })
    }

    const result = await createBadge({
      orgId: orgContext.orgId,
      name: name.trim(),
      description,
      icon,
      color,
      tier,
      category,
      criteriaType,
      criteriaThreshold,
      createdBy: authResult.user.id,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ badgeId: result.badgeId, success: true })
  } catch (error) {
    console.error("Error creating badge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

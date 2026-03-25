import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { seedDefaultBadges, seedDefaultValues } from "@/lib/recognition/badges"

// POST /api/recognition/badges/seed - Seed default badges and values (admin only)
export async function POST() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    if (orgContext.role !== "owner" && orgContext.role !== "admin") {
      return NextResponse.json({ error: "Only admins can seed badges" }, { status: 403 })
    }

    await seedDefaultBadges(orgContext.orgId, authResult.user.id)
    await seedDefaultValues(orgContext.orgId, authResult.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error seeding badges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"
import { getRecognitionSettings } from "@/lib/recognition/kudos"

// GET /api/recognition/settings - Get recognition settings
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const settings = await getRecognitionSettings(orgContext.orgId)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error fetching recognition settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/recognition/settings - Update recognition settings (admin only)
export async function PUT(request: Request) {
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
      return NextResponse.json({ error: "Only admins can update settings" }, { status: 403 })
    }

    const body = await request.json()

    // Merge with existing settings
    await pgClient.query(
      `UPDATE organizations
       SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('recognition', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(body), orgContext.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating recognition settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

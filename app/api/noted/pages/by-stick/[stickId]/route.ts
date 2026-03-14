import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

// GET /api/noted/pages/by-stick/[stickId] - Check if a Stick has a Noted page
export async function GET(request: NextRequest, context: { params: Promise<{ stickId: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const params = await context.params
    if (!validateUUID(params.stickId)) return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })

    const db = await createServiceDatabaseClient()

    // Check both stick_id and personal_stick_id
    const isPersonal = request.nextUrl.searchParams.get("personal") === "true"

    const column = isPersonal ? "personal_stick_id" : "stick_id"

    const { data } = await db
      .from("noted_pages")
      .select("id")
      .eq(column, params.stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    return NextResponse.json({ data, exists: !!data })
  } catch (err) {
    console.error("GET /api/noted/pages/by-stick/[stickId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

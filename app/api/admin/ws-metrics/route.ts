import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export const dynamic = "force-dynamic"

declare global {
  // eslint-disable-next-line no-var
  var __wsMetrics: { getMetrics: () => Record<string, unknown> } | undefined
}

/**
 * GET /api/admin/ws-metrics
 * Returns WebSocket server metrics (owner-only).
 */
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user is an org owner
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const db = await createDatabaseClient()
    const { data: membership } = await db
      .from("organization_members")
      .select("role")
      .eq("user_id", authResult.user.id)
      .eq("org_id", orgContext.orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const metrics = globalThis.__wsMetrics?.getMetrics() ?? {
      error: "WebSocket server not initialized",
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error("[WS Metrics] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db as pgClient } from "@/lib/database/pg-client"

// PUT /api/noted/groups/reorder - Bulk reorder groups
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const body = await request.json()
    const { order } = body // Array of { id: string, sort_order: number }

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "Order array is required" }, { status: 400 })
    }

    // Update all in a transaction
    await pgClient.query("BEGIN")
    try {
      for (const item of order) {
        await pgClient.query(
          `UPDATE noted_groups SET sort_order = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND org_id = $4`,
          [item.sort_order, item.id, user.id, orgContext.orgId]
        )
      }
      await pgClient.query("COMMIT")
    } catch (err) {
      await pgClient.query("ROLLBACK")
      throw err
    }

    return NextResponse.json({ message: "Groups reordered" })
  } catch (err) {
    console.error("PUT /api/noted/groups/reorder error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

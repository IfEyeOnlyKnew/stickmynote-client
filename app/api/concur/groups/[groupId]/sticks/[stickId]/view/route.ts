import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/concur/groups/[groupId]/sticks/[stickId]/view
 *
 * Records a unique view for the current user on this stick.
 * Uses INSERT ON CONFLICT DO NOTHING — idempotent, fire-and-forget.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId, stickId } = await params

    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    if (!validateUUID(groupId) || !validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    // Verify user is a member of the group
    const memberCheck = await db.query(
      `SELECT 1 FROM concur_group_members WHERE group_id = $1 AND user_id = $2 AND org_id = $3 LIMIT 1`,
      [groupId, user.id, orgContext.orgId]
    )
    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Verify stick belongs to this group
    const stickCheck = await db.query(
      `SELECT 1 FROM concur_sticks WHERE id = $1 AND group_id = $2 LIMIT 1`,
      [stickId, groupId]
    )
    if (stickCheck.rows.length === 0) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Upsert view — idempotent
    await db.query(
      `INSERT INTO concur_stick_views (stick_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (stick_id, user_id) DO NOTHING`,
      [stickId, user.id]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[ConcurStickView] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

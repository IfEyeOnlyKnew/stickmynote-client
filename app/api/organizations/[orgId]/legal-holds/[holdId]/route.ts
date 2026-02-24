import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { logAuditEvent } from "@/lib/audit/audit-logger"

export const dynamic = "force-dynamic"

async function verifyOwner(userId: string, orgId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT role FROM organization_members
     WHERE user_id = $1 AND org_id = $2 AND status = 'active'
     LIMIT 1`,
    [userId, orgId],
  )
  return result.rows.length > 0 && result.rows[0].role === "owner"
}

/**
 * PATCH /api/organizations/[orgId]/legal-holds/[holdId]
 * Release a legal hold.
 * Body: { action: "release" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; holdId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId, holdId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json(
        { error: "Only organization owners can release legal holds" },
        { status: 403 },
      )
    }

    const body = await request.json()
    if (body.action !== "release") {
      return NextResponse.json(
        { error: "Only 'release' action is supported" },
        { status: 400 },
      )
    }

    // Verify hold exists and is active
    const holdCheck = await db.query(
      `SELECT * FROM legal_holds
       WHERE id = $1 AND org_id = $2 AND status = 'active'
       LIMIT 1`,
      [holdId, orgId],
    )
    if (holdCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Legal hold not found or already released" },
        { status: 404 },
      )
    }

    const oldHold = holdCheck.rows[0]

    const result = await db.query(
      `UPDATE legal_holds
       SET status = 'released', released_at = NOW(), released_by = $1
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [session.user.id, holdId, orgId],
    )

    const hold = result.rows[0]

    await logAuditEvent({
      userId: session.user.id,
      action: "legal_hold.released",
      resourceType: "legal_hold",
      resourceId: holdId,
      oldValues: { status: "active", holdName: oldHold.hold_name, targetUserId: oldHold.user_id },
      newValues: { status: "released" },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      metadata: { org_id: orgId },
    })

    return NextResponse.json({ hold })
  } catch (error) {
    console.error("[LegalHold] Release error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

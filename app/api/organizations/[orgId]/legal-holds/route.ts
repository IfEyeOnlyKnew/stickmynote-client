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
 * GET /api/organizations/[orgId]/legal-holds
 * List legal holds. Optional ?status=active|released filter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json(
        { error: "Only organization owners can view legal holds" },
        { status: 403 },
      )
    }

    const statusFilter = request.nextUrl.searchParams.get("status")
    let query: string
    let queryParams: string[]

    if (statusFilter === "active" || statusFilter === "released") {
      query = `
        SELECT lh.*,
               u.email AS user_email,
               u.full_name AS user_full_name,
               cb.email AS created_by_email,
               rb.email AS released_by_email
        FROM legal_holds lh
        JOIN users u ON u.id = lh.user_id
        JOIN users cb ON cb.id = lh.created_by
        LEFT JOIN users rb ON rb.id = lh.released_by
        WHERE lh.org_id = $1 AND lh.status = $2
        ORDER BY lh.created_at DESC`
      queryParams = [orgId, statusFilter]
    } else {
      query = `
        SELECT lh.*,
               u.email AS user_email,
               u.full_name AS user_full_name,
               cb.email AS created_by_email,
               rb.email AS released_by_email
        FROM legal_holds lh
        JOIN users u ON u.id = lh.user_id
        JOIN users cb ON cb.id = lh.created_by
        LEFT JOIN users rb ON rb.id = lh.released_by
        WHERE lh.org_id = $1
        ORDER BY lh.created_at DESC`
      queryParams = [orgId]
    }

    const result = await db.query(query, queryParams)
    return NextResponse.json({ holds: result.rows })
  } catch (error) {
    console.error("[LegalHold] List error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/organizations/[orgId]/legal-holds
 * Create a new legal hold on a user.
 * Body: { userId, holdName, description? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    if (!(await verifyOwner(session.user.id, orgId))) {
      return NextResponse.json(
        { error: "Only organization owners can create legal holds" },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { userId, holdName, description } = body

    if (!userId || !holdName) {
      return NextResponse.json(
        { error: "userId and holdName are required" },
        { status: 400 },
      )
    }

    // Verify target user is an org member
    const memberCheck = await db.query(
      `SELECT 1 FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'
       LIMIT 1`,
      [userId, orgId],
    )
    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "User is not an active member of this organization" },
        { status: 400 },
      )
    }

    const result = await db.query(
      `INSERT INTO legal_holds (org_id, user_id, hold_name, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, userId, holdName, description || null, session.user.id],
    )

    const hold = result.rows[0]

    await logAuditEvent({
      userId: session.user.id,
      action: "legal_hold.created",
      resourceType: "legal_hold",
      resourceId: hold.id,
      newValues: { holdName, targetUserId: userId, description },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      metadata: { org_id: orgId },
    })

    return NextResponse.json({ hold }, { status: 201 })
  } catch (error) {
    console.error("[LegalHold] Create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

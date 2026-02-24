import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { logAuditEvent } from "@/lib/audit/audit-logger"

export const dynamic = "force-dynamic"

const MAX_ROWS = 10000

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
 * Safely query a table — returns empty array if table doesn't exist.
 */
async function safeQuery(
  sql: string,
  queryParams: unknown[],
): Promise<Record<string, unknown>[]> {
  try {
    const result = await db.query(sql, queryParams)
    return result.rows
  } catch {
    return []
  }
}

/**
 * POST /api/organizations/[orgId]/ediscovery/export
 * Export all content for a user across the organization.
 * Body: { userId, dateFrom?, dateTo? }
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
        { error: "Only organization owners can export user data" },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { userId, dateFrom, dateTo } = body

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
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

    // Build date filter clause
    let dateFilter = ""
    const dateParams: unknown[] = []
    let paramOffset = 2 // $1 = userId, $2 = orgId or just $1 = userId depending on query

    if (dateFrom) {
      paramOffset++
      dateFilter += ` AND created_at >= $${paramOffset}::timestamptz`
      dateParams.push(dateFrom)
    }
    if (dateTo) {
      paramOffset++
      dateFilter += ` AND created_at <= $${paramOffset}::timestamptz`
      dateParams.push(dateTo)
    }

    // Build date filter for tables with only userId (no orgId column)
    let dateFilterUser = ""
    const dateParamsUser: unknown[] = []
    let paramOffsetUser = 1 // $1 = userId

    if (dateFrom) {
      paramOffsetUser++
      dateFilterUser += ` AND created_at >= $${paramOffsetUser}::timestamptz`
      dateParamsUser.push(dateFrom)
    }
    if (dateTo) {
      paramOffsetUser++
      dateFilterUser += ` AND created_at <= $${paramOffsetUser}::timestamptz`
      dateParamsUser.push(dateTo)
    }

    // Run all queries in parallel for performance
    const [
      personalSticks,
      paksSticks,
      socialSticks,
      socialStickReplies,
      socialPads,
      socialPadMessages,
      calstickEvents,
      auditTrail,
    ] = await Promise.all([
      // Personal sticks (user-owned)
      safeQuery(
        `SELECT * FROM personal_sticks
         WHERE user_id = $1${dateFilterUser}
         ORDER BY created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, ...dateParamsUser],
      ),

      // Paks pad sticks (user-created in org pads)
      safeQuery(
        `SELECT pps.* FROM paks_pad_sticks pps
         JOIN social_pads sp ON sp.id = pps.pad_id
         WHERE pps.user_id = $1 AND sp.org_id = $2${dateFilter}
         ORDER BY pps.created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, orgId, ...dateParams],
      ),

      // Social sticks
      safeQuery(
        `SELECT ss.* FROM social_sticks ss
         JOIN social_pads sp ON sp.id = ss.pad_id
         WHERE ss.user_id = $1 AND sp.org_id = $2${dateFilter}
         ORDER BY ss.created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, orgId, ...dateParams],
      ),

      // Social stick replies
      safeQuery(
        `SELECT ssr.* FROM social_stick_replies ssr
         JOIN social_sticks ss ON ss.id = ssr.stick_id
         JOIN social_pads sp ON sp.id = ss.pad_id
         WHERE ssr.user_id = $1 AND sp.org_id = $2${dateFilter}
         ORDER BY ssr.created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, orgId, ...dateParams],
      ),

      // Social pads (owned by user)
      safeQuery(
        `SELECT * FROM social_pads
         WHERE created_by = $1 AND org_id = $2${dateFilter}
         ORDER BY created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, orgId, ...dateParams],
      ),

      // Social pad messages
      safeQuery(
        `SELECT spm.* FROM social_pad_messages spm
         JOIN social_pads sp ON sp.id = spm.pad_id
         WHERE spm.user_id = $1 AND sp.org_id = $2${dateFilter}
         ORDER BY spm.created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, orgId, ...dateParams],
      ),

      // Calstick events
      safeQuery(
        `SELECT ce.* FROM calstick_events ce
         WHERE ce.user_id = $1${dateFilterUser}
         ORDER BY ce.created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, ...dateParamsUser],
      ),

      // Audit trail for this user
      safeQuery(
        `SELECT * FROM audit_trail
         WHERE user_id = $1${dateFilterUser}
         ORDER BY created_at DESC
         LIMIT ${MAX_ROWS}`,
        [userId, ...dateParamsUser],
      ),
    ])

    const exportData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.id,
        targetUserId: userId,
        orgId,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      personalSticks,
      paksSticks,
      socialSticks,
      socialStickReplies,
      socialPads,
      socialPadMessages,
      calstickEvents,
      auditTrail,
      summary: {
        personalSticks: personalSticks.length,
        paksSticks: paksSticks.length,
        socialSticks: socialSticks.length,
        socialStickReplies: socialStickReplies.length,
        socialPads: socialPads.length,
        socialPadMessages: socialPadMessages.length,
        calstickEvents: calstickEvents.length,
        auditTrail: auditTrail.length,
      },
    }

    await logAuditEvent({
      userId: session.user.id,
      action: "ediscovery.export",
      resourceType: "ediscovery",
      resourceId: userId,
      metadata: {
        org_id: orgId,
        targetUserId: userId,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        recordCounts: exportData.summary,
      },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    })

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ediscovery-${userId}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error("[eDiscovery] Export error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

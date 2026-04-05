import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * GET /api/organizations/[orgId]/audit-logs
 *
 * Query audit trail with filters. Owner and Admin access only.
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

    // Verify user is owner or admin of the org
    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [session.user.id, orgId],
    )

    if (memberResult.rows.length === 0 || !["owner", "admin"].includes(memberResult.rows[0].role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "25", 10)))
    const offset = (page - 1) * limit
    const from = searchParams.get("from") || null
    const to = searchParams.get("to") || null
    const action = searchParams.get("action") || null
    const userId = searchParams.get("userId") || null
    const resourceType = searchParams.get("resourceType") || null
    const search = searchParams.get("search") || null

    // Build query with filters
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    // Scope to org: only show events for users who are members of this org
    conditions.push(`(al.user_id IN (SELECT user_id FROM organization_members WHERE org_id = $${paramIdx}) OR al.metadata->>'orgId' = $${paramIdx}::text)`)
    values.push(orgId)
    paramIdx++

    if (from) {
      conditions.push(`al.created_at >= $${paramIdx}::timestamptz`)
      values.push(from)
      paramIdx++
    }

    if (to) {
      conditions.push(`al.created_at <= $${paramIdx}::timestamptz`)
      values.push(to)
      paramIdx++
    }

    if (action) {
      conditions.push(`al.action = $${paramIdx}`)
      values.push(action)
      paramIdx++
    }

    if (userId) {
      conditions.push(`al.user_id = $${paramIdx}::uuid`)
      values.push(userId)
      paramIdx++
    }

    if (resourceType) {
      conditions.push(`al.resource_type = $${paramIdx}`)
      values.push(resourceType)
      paramIdx++
    }

    if (search) {
      conditions.push(`(al.action ILIKE $${paramIdx} OR al.resource_type ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.full_name ILIKE $${paramIdx})`)
      values.push(`%${search}%`)
      paramIdx++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM audit_trail al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}`,
      values,
    )

    const total = Number.parseInt(countResult.rows[0].total, 10)

    // Get paginated results
    const logsResult = await db.query(
      `SELECT al.id, al.user_id, al.action, al.resource_type, al.resource_id,
              al.old_values, al.new_values, al.ip_address, al.user_agent,
              al.metadata, al.created_at,
              u.email as user_email, u.full_name as user_name
       FROM audit_trail al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, limit, offset],
    )

    return NextResponse.json({
      logs: logsResult.rows,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("[Audit Logs API] Error:", error)
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 })
  }
}

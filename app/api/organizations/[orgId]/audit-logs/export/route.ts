import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

const MAX_EXPORT_ROWS = 10000

/**
 * POST /api/organizations/[orgId]/audit-logs/export
 *
 * Export audit logs as CSV or JSON. Owner and Admin access only.
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

    // Verify owner or admin
    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [session.user.id, orgId],
    )

    if (memberResult.rows.length === 0 || !["owner", "admin"].includes(memberResult.rows[0].role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const { format = "csv", from, to, action, userId, resourceType } = body

    // Build query
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await db.query(
      `SELECT al.id, al.action, al.resource_type, al.resource_id,
              al.ip_address, al.user_agent, al.created_at,
              u.email as user_email, u.full_name as user_name
       FROM audit_trail al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIdx}`,
      [...values, MAX_EXPORT_ROWS],
    )

    if (format === "json") {
      return new NextResponse(JSON.stringify(result.rows, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    }

    // CSV format
    const headers = ["Timestamp", "User Email", "User Name", "Action", "Resource Type", "Resource ID", "IP Address"]
    const csvRows = [headers.join(",")]

    for (const row of result.rows) {
      csvRows.push([
        row.created_at,
        escapeCsv(row.user_email || ""),
        escapeCsv(row.user_name || ""),
        row.action,
        row.resource_type,
        row.resource_id || "",
        row.ip_address || "",
      ].join(","))
    }

    return new NextResponse(csvRows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error("[Audit Export] Error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

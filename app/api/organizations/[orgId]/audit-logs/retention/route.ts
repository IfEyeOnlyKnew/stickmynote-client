import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

const DEFAULT_RETENTION_DAYS = 90

/**
 * GET /api/organizations/[orgId]/audit-logs/retention
 *
 * Get the current audit log retention setting for the organization.
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

    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [session.user.id, orgId],
    )

    if (memberResult.rows.length === 0 || !["owner", "admin"].includes(memberResult.rows[0].role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const orgResult = await db.query(
      `SELECT COALESCE((settings->>'audit_retention_days')::int, $1) as retention_days
       FROM organizations WHERE id = $2`,
      [DEFAULT_RETENTION_DAYS, orgId],
    )

    const retentionDays = orgResult.rows.length > 0 ? orgResult.rows[0].retention_days : DEFAULT_RETENTION_DAYS

    return NextResponse.json({ retentionDays })
  } catch (error) {
    console.error("[Audit Retention] GET error:", error)
    return NextResponse.json({ error: "Failed to load retention setting" }, { status: 500 })
  }
}

/**
 * PATCH /api/organizations/[orgId]/audit-logs/retention
 *
 * Update the audit log retention setting. Owner only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    // Only owners can change retention
    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [session.user.id, orgId],
    )

    if (memberResult.rows.length === 0 || memberResult.rows[0].role !== "owner") {
      return NextResponse.json({ error: "Only organization owners can change retention settings" }, { status: 403 })
    }

    const body = await request.json()
    const { retentionDays } = body

    if (typeof retentionDays !== "number" || ![30, 60, 90, 180, 365].includes(retentionDays)) {
      return NextResponse.json({ error: "Invalid retention period" }, { status: 400 })
    }

    // Use jsonb_set to merge into existing settings without overwriting
    await db.query(
      `UPDATE organizations
       SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('audit_retention_days', $1::int),
           updated_at = NOW()
       WHERE id = $2`,
      [retentionDays, orgId],
    )

    return NextResponse.json({ success: true, retentionDays })
  } catch (error) {
    console.error("[Audit Retention] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update retention setting" }, { status: 500 })
  }
}

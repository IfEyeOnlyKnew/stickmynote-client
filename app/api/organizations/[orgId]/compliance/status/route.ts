import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { getComplianceStatus } from "@/lib/compliance/compliance-checker"

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
 * GET /api/organizations/[orgId]/compliance/status
 * Returns compliance readiness across SOC 2, ISO 27001, GDPR, and HIPAA.
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
        { error: "Only organization owners can view compliance status" },
        { status: 403 },
      )
    }

    const status = await getComplianceStatus(orgId)
    return NextResponse.json(status)
  } catch (error) {
    console.error("[Compliance] Status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

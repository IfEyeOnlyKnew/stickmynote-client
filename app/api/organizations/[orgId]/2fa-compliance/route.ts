// API Route: Organization 2FA Compliance List
// GET /api/organizations/[orgId]/2fa-compliance

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { getUsersNeedingCompliance } from "@/lib/auth/2fa-policy"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * GET - Get list of users who need to enable 2FA
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    // Check if user is org admin
    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'
       LIMIT 1`,
      [session.user.id, orgId]
    )

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    const role = memberResult.rows[0].role
    const isAdmin = ["owner", "admin"].includes(role)

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only organization admins can view compliance data" },
        { status: 403 }
      )
    }

    // Get policy and users needing compliance
    const policy = await db.query(
      `SELECT require_2fa FROM organization_2fa_policies WHERE org_id = $1 LIMIT 1`,
      [orgId]
    )

    const policyEnabled = policy.rows[0]?.require_2fa || false
    const users = await getUsersNeedingCompliance(orgId)

    return NextResponse.json({
      users,
      policyEnabled,
    })
  } catch (error) {
    console.error("[2FA Compliance] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch compliance data" }, { status: 500 })
  }
}

// API Route: Organization 2FA Policy Management
// GET/PUT /api/organizations/[orgId]/2fa-policy

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getOrgPolicy,
  enableOrgEnforcement,
  disableOrgEnforcement,
  getOrgComplianceStats,
} from "@/lib/auth/2fa-policy"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * GET - Get organization's 2FA policy and compliance stats
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
        { error: "Only organization admins can view 2FA policy" },
        { status: 403 }
      )
    }

    // Get policy and stats
    const policy = await getOrgPolicy(orgId)
    const stats = await getOrgComplianceStats(orgId)

    return NextResponse.json({
      policy: policy || {
        require_2fa: false,
        enforce_for_admins_only: false,
        grace_period_days: 30,
      },
      stats,
    })
  } catch (error) {
    console.error("[2FA Policy] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch policy" }, { status: 500 })
  }
}

/**
 * PUT - Update organization's 2FA policy
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    // Check if user is org owner
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
    if (role !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can modify 2FA policy" },
        { status: 403 }
      )
    }

    const { require2FA, adminsOnly, gracePeriodDays } = await request.json()

    console.log("[2FA Policy] Updating policy:", { orgId, require2FA, adminsOnly, gracePeriodDays })

    try {
      if (require2FA) {
        await enableOrgEnforcement(orgId, {
          adminsOnly: adminsOnly || false,
          gracePeriodDays: gracePeriodDays || 30,
        })
      } else {
        await disableOrgEnforcement(orgId)
      }
    } catch (dbError) {
      console.error("[2FA Policy] Database error:", dbError)
      throw dbError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[2FA Policy] PUT error:", error)
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : "Failed to update policy"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

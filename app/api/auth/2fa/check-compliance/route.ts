// API Route: Check User's 2FA Compliance Status
// GET /api/auth/2fa/check-compliance

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { checkUserCompliance } from "@/lib/auth/2fa-policy"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ compliant: true })
    }

    const userId = session.user.id

    // Get user's organization
    const orgResult = await db.query(
      `SELECT org_id FROM organization_members
       WHERE user_id = $1 AND status = 'active'
       LIMIT 1`,
      [userId]
    )

    if (orgResult.rows.length === 0) {
      return NextResponse.json({ compliant: true })
    }

    const orgId = orgResult.rows[0].org_id

    // Check compliance
    const compliance = await checkUserCompliance(userId, orgId)

    // Return status for banner
    return NextResponse.json({
      compliant: compliance.compliant,
      gracePeriod: compliance.gracePeriodEnds
        ? {
            daysRemaining: compliance.daysRemaining,
            message: `You have ${compliance.daysRemaining} day${compliance.daysRemaining && compliance.daysRemaining > 1 ? "s" : ""} to enable two-factor authentication.`,
          }
        : undefined,
      requiresSetup: !compliance.compliant,
    })
  } catch (error) {
    console.error("[2FA Check Compliance] Error:", error)
    return NextResponse.json({ compliant: true })
  }
}

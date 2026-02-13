// API Route: Initialize 2FA Setup
// POST /api/auth/2fa/setup

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { initiate2FASetup } from "@/lib/auth/2fa"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Get current session
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email

    // Get user's organization
    const orgResult = await db.query(
      `SELECT om.org_id FROM organization_members om
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    )

    if (orgResult.rows.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 })
    }

    const orgId = orgResult.rows[0].org_id

    // Initialize 2FA setup
    const setup = await initiate2FASetup(userId, orgId, userEmail)

    return NextResponse.json({
      success: true,
      secret: setup.secret,
      qrCodeUri: setup.qrCodeUri,
      backupCodes: setup.backupCodes,
    })
  } catch (error) {
    console.error("[2FA Setup] Error:", error)
    return NextResponse.json({ error: "Failed to setup 2FA" }, { status: 500 })
  }
}

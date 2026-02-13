// API Route: Regenerate Backup Codes
// POST /api/auth/2fa/regenerate-backup-codes

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { regenerateBackupCodes } from "@/lib/auth/2fa"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Verification code required" }, { status: 400 })
    }

    const userId = session.user.id

    // Get org ID
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
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")

    // Regenerate backup codes (requires verification)
    const result = await regenerateBackupCodes(userId, orgId, code, ipAddress)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to regenerate codes" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      backupCodes: result.backupCodes,
    })
  } catch (error) {
    console.error("[2FA Regenerate Codes] Error:", error)
    return NextResponse.json({ error: "Failed to regenerate backup codes" }, { status: 500 })
  }
}

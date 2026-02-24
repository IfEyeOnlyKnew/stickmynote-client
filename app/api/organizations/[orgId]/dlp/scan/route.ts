import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { scanContent } from "@/lib/dlp/content-scanner"
import type { DLPSettings } from "@/types/organization"

export const dynamic = "force-dynamic"

/**
 * POST /api/organizations/[orgId]/dlp/scan
 *
 * Scan content for sensitive data patterns.
 * Used by client-side editors to preview DLP warnings before sharing.
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

    // Verify membership
    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
      [session.user.id, orgId],
    )

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Load org DLP settings for custom patterns
    const orgResult = await db.query(
      `SELECT settings->'dlp' as dlp FROM organizations WHERE id = $1`,
      [orgId],
    )

    const dlp: DLPSettings | null = orgResult.rows[0]?.dlp || null

    // If scanning is not enabled, return clean result
    if (!dlp?.content_scanning_enabled) {
      return NextResponse.json({ hasSensitiveData: false, warnings: [] })
    }

    const result = scanContent(content, dlp.scan_patterns)

    const warnings = result.matches.map(
      (m) => `${m.count} ${m.label} pattern${m.count > 1 ? "s" : ""} detected`,
    )

    return NextResponse.json({
      hasSensitiveData: result.hasSensitiveData,
      warnings,
      scanAction: dlp.scan_action || "warn",
    })
  } catch (error) {
    console.error("[DLP Scan] Error:", error)
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}

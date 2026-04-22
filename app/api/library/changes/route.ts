import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { checkStickLibraryPermissions, type StickType } from "@/lib/library/library-permissions"

/**
 * GET /api/library/changes?stickId=...&stickType=...&since=<ISO8601>
 *
 * Returns library files for the stick that were created after `since`.
 * Used by the Tauri desktop client to pull remote-originated changes.
 *
 * If `since` is omitted, returns all files (equivalent to the main list endpoint
 * but with a smaller payload — no permissions/role block).
 *
 * Hard-deletes are not tracked yet; pull-side sync only sees additions/updates for v1.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const stickId = searchParams.get("stickId")
    const stickType = searchParams.get("stickType") as StickType
    const since = searchParams.get("since")

    if (!stickId || !stickType) {
      return NextResponse.json({ error: "stickId and stickType are required" }, { status: 400 })
    }

    let sinceDate: Date | null = null
    if (since) {
      const parsed = new Date(since)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "since must be an ISO8601 timestamp" }, { status: 400 })
      }
      sinceDate = parsed
    }

    const perms = await checkStickLibraryPermissions(authResult.user.id, orgContext.orgId, stickId, stickType)
    if (!perms.allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const params: unknown[] = [orgContext.orgId, stickId]
    let sinceClause = ""
    if (sinceDate) {
      params.push(sinceDate.toISOString())
      sinceClause = `AND lf.created_at > $${params.length}`
    }

    const result = await db.query(
      `SELECT lf.id, lf.filename, lf.original_filename, lf.file_path, lf.file_url,
              lf.mime_type, lf.file_size, lf.uploaded_by, lf.description,
              lf.metadata, lf.created_at, lf.updated_at
         FROM library_files lf
        WHERE lf.org_id = $1
          AND lf.scope_type = 'stick'
          AND lf.scope_id = $2
          ${sinceClause}
        ORDER BY lf.created_at ASC`,
      params,
    )

    return NextResponse.json({
      files: result.rows,
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Library:changes] error:", error)
    return NextResponse.json({ error: "Failed to list changes" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"

/**
 * CLEANUP AUDIT LOGS CRON JOB
 *
 * Deletes audit trail entries older than the retention period.
 * Default retention: 90 days. Orgs can override via settings JSONB.
 *
 * Configure in your cron system:
 * { "path": "/api/cron/cleanup-audit-logs", "schedule": "0 3 * * *" }
 * (Runs daily at 3 AM)
 */

export const dynamic = "force-dynamic"

const CRON_SECRET = process.env.CRON_SECRET
const DEFAULT_RETENTION_DAYS = 90

export async function GET(request: Request) {
  try {
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization")
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const startTime = Date.now()

    // Get org-specific retention settings
    const orgsResult = await db.query(
      `SELECT id, COALESCE((settings->>'audit_retention_days')::int, $1) AS retention_days
       FROM organizations`,
      [DEFAULT_RETENTION_DAYS],
    )

    let totalDeleted = 0
    const orgResults: { orgId: string; deleted: number; retentionDays: number }[] = []

    for (const org of orgsResult.rows) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - org.retention_days)

      // Delete audit entries for this org's members that are older than retention
      const deleteResult = await db.query(
        `DELETE FROM audit_trail
         WHERE created_at < $1
         AND (
           user_id IN (SELECT user_id FROM organization_members WHERE org_id = $2)
           OR metadata->>'orgId' = $2::text
         )`,
        [cutoffDate.toISOString(), org.id],
      )

      const deleted = parseInt(deleteResult.rowCount?.toString() || "0", 10)
      if (deleted > 0) {
        totalDeleted += deleted
        orgResults.push({ orgId: org.id, deleted, retentionDays: org.retention_days })
        console.log(`[CleanupAuditLogs] Deleted ${deleted} entries for org ${org.id} (retention: ${org.retention_days} days)`)
      }
    }

    // Also clean up orphaned entries (no org association) using default retention
    const defaultCutoff = new Date()
    defaultCutoff.setDate(defaultCutoff.getDate() - DEFAULT_RETENTION_DAYS)

    const orphanResult = await db.query(
      `DELETE FROM audit_trail
       WHERE created_at < $1
       AND user_id NOT IN (SELECT DISTINCT user_id FROM organization_members)
       AND (metadata->>'orgId') IS NULL`,
      [defaultCutoff.toISOString()],
    )

    const orphanDeleted = parseInt(orphanResult.rowCount?.toString() || "0", 10)
    totalDeleted += orphanDeleted

    const duration = Date.now() - startTime

    console.log(`[CleanupAuditLogs] Completed: deleted ${totalDeleted} entries in ${duration}ms`)

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      orgsProcessed: orgResults.length,
      orphanedDeleted: orphanDeleted,
      details: orgResults,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[CleanupAuditLogs] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}

import { NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"

/**
 * CLEANUP PAD CHAT MESSAGES CRON JOB
 *
 * Deletes pad chat messages based on retention policy settings.
 * Each pad can have its own retention policy (message_retention_days).
 *
 * Configure in vercel.json or your cron system:
 * { "path": "/api/cron/cleanup-pad-messages", "schedule": "0 4 * * *" }
 * (Runs daily at 4 AM)
 */

export const dynamic = "force-dynamic"

// For security in production, verify the cron secret
const CRON_SECRET = process.env.CRON_SECRET

function verifyCronAuth(request: Request): boolean {
  if (!CRON_SECRET) return true
  return request.headers.get("authorization") === `Bearer ${CRON_SECRET}`
}

function makeCleanupResult(deletedCount: number, padsProcessed: number, extra?: Record<string, string>) {
  return NextResponse.json({ success: true, deletedCount, padsProcessed, ...extra })
}

async function cleanupPadMessages(db: any, pad: { social_pad_id: string; message_retention_days: number }): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - pad.message_retention_days)

  const { count, error: deleteError } = await db
    .from("social_pad_messages")
    .delete()
    .eq("social_pad_id", pad.social_pad_id)
    .eq("is_pinned", false)
    .lt("created_at", cutoffDate.toISOString())

  if (deleteError) {
    console.error(`[CleanupPadMessages] Error deleting from pad ${pad.social_pad_id}:`, deleteError)
    return 0
  }

  if (count && count > 0) {
    console.log(`[CleanupPadMessages] Deleted ${count} messages from pad ${pad.social_pad_id}`)
  }

  return count || 0
}

export async function GET(request: Request) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startTime = Date.now()
    const db = await createServiceDatabaseClient()

    const { data: padsWithRetention, error: settingsError } = await db
      .from("social_pad_chat_settings")
      .select("social_pad_id, message_retention_days")
      .eq("message_retention_enabled", true)
      .gt("message_retention_days", 0)

    if (settingsError?.code === "42703") {
      console.log("[CleanupPadMessages] message_retention columns not found - skipping")
      return makeCleanupResult(0, 0, { message: "Retention columns not yet added to database" })
    }
    if (settingsError) {
      throw settingsError
    }

    if (!padsWithRetention || padsWithRetention.length === 0) {
      return makeCleanupResult(0, 0, { message: "No pads with retention policy enabled" })
    }

    let totalDeleted = 0
    let processedCount = 0

    for (const pad of padsWithRetention) {
      const deleted = await cleanupPadMessages(db, pad)
      totalDeleted += deleted
      if (deleted > 0) processedCount++
    }

    const duration = Date.now() - startTime
    console.log(`[CleanupPadMessages] Completed: deleted ${totalDeleted} messages from ${processedCount} pads in ${duration}ms`)

    return makeCleanupResult(totalDeleted, processedCount, {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[CleanupPadMessages] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request)
}

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

export async function GET(request: Request) {
  try {
    // Optional: Verify cron secret for security
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization")
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const startTime = Date.now()
    const db = await createServiceDatabaseClient()

    // Get all pads with retention enabled
    const { data: padsWithRetention, error: settingsError } = await db
      .from("social_pad_chat_settings")
      .select("social_pad_id, message_retention_days")
      .eq("message_retention_enabled", true)
      .gt("message_retention_days", 0)

    if (settingsError) {
      // Table might not have the column yet - that's ok
      if (settingsError.code === "42703") {
        console.log("[CleanupPadMessages] message_retention columns not found - skipping")
        return NextResponse.json({
          success: true,
          deletedCount: 0,
          padsProcessed: 0,
          message: "Retention columns not yet added to database",
        })
      }
      throw settingsError
    }

    if (!padsWithRetention || padsWithRetention.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        padsProcessed: 0,
        message: "No pads with retention policy enabled",
      })
    }

    let totalDeleted = 0
    const padsProcessed: string[] = []

    for (const pad of padsWithRetention) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - pad.message_retention_days)
      const cutoffISO = cutoffDate.toISOString()

      // Delete old messages (keep pinned messages)
      const { count, error: deleteError } = await db
        .from("social_pad_messages")
        .delete()
        .eq("social_pad_id", pad.social_pad_id)
        .eq("is_pinned", false)
        .lt("created_at", cutoffISO)

      if (deleteError) {
        console.error(`[CleanupPadMessages] Error deleting from pad ${pad.social_pad_id}:`, deleteError)
        continue
      }

      if (count && count > 0) {
        totalDeleted += count
        padsProcessed.push(pad.social_pad_id)
        console.log(`[CleanupPadMessages] Deleted ${count} messages from pad ${pad.social_pad_id}`)
      }
    }

    const duration = Date.now() - startTime

    console.log(`[CleanupPadMessages] Completed: deleted ${totalDeleted} messages from ${padsProcessed.length} pads in ${duration}ms`)

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      padsProcessed: padsProcessed.length,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[CleanupPadMessages] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request)
}

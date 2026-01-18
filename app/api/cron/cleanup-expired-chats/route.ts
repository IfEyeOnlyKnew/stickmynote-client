import { NextResponse } from "next/server"
import { deleteExpiredChats } from "@/lib/database/stick-chat-queries"

/**
 * CLEANUP EXPIRED CHATS CRON JOB
 *
 * Deletes stick chats that have passed their expiration date.
 * Default expiration is 30 days from creation.
 *
 * Configure in vercel.json or your cron system:
 * { "path": "/api/cron/cleanup-expired-chats", "schedule": "0 3 * * *" }
 * (Runs daily at 3 AM)
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
    const deletedCount = await deleteExpiredChats()
    const duration = Date.now() - startTime

    console.log(`[CleanupExpiredChats] Deleted ${deletedCount} expired chats in ${duration}ms`)

    return NextResponse.json({
      success: true,
      deletedCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[CleanupExpiredChats] Error:", error)
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

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"

// POST /api/inference-notifications/mark-read - Mark a social notification as read
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = session.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await req.json()
    const { notificationKey } = body

    if (!notificationKey) {
      return NextResponse.json({ error: "Notification key required" }, { status: 400 })
    }

    await db.query(
      `INSERT INTO inference_notification_reads (user_id, notification_key, last_read_at, org_id)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (user_id, notification_key)
       DO UPDATE SET last_read_at = NOW()`,
      [user.id, notificationKey, orgContext.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in mark-read POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

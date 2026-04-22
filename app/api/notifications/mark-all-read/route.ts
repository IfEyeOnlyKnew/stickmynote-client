import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db } from "@/lib/database/pg-client"

// POST /api/notifications/mark-all-read - Mark all of the user's notifications as read
export async function POST() {
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    await db.query(
      `UPDATE notifications
          SET is_read = true,
              read_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1
          AND org_id = $2
          AND is_read = false`,
      [authResult.user.id, orgContext.orgId],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in mark-all-read POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

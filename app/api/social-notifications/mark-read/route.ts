import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// POST /api/social-notifications/mark-read - Mark a social notification as read
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await req.json()
    const { notificationKey } = body

    if (!notificationKey) {
      return NextResponse.json({ error: "Notification key required" }, { status: 400 })
    }

    const { error: upsertError } = await supabase.from("social_notification_reads").upsert(
      {
        user_id: user.id,
        notification_key: notificationKey,
        last_read_at: new Date().toISOString(),
        org_id: orgContext.orgId,
      },
      {
        onConflict: "user_id,notification_key",
      },
    )

    if (upsertError) {
      console.error("[v0] Error marking notification as read:", upsertError)
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in mark-read POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { action, entryIds, note } = await request.json()

    if (!action || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: "action and entryIds[] are required" }, { status: 400 })
    }

    const validActions = ["submit", "approve", "reject"]
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be: ${validActions.join(", ")}` }, { status: 400 })
    }

    if (action === "submit") {
      // User submits their own draft entries for approval
      const { data, error } = await db
        .from("time_entries")
        .update({ approval_status: "submitted", updated_at: new Date().toISOString() })
        .in("id", entryIds)
        .eq("user_id", user.id)
        .eq("approval_status", "draft")
        .select("id")

      if (error) throw error
      return NextResponse.json({ updated: data?.length || 0 })
    }

    if (action === "approve") {
      const { data, error } = await db
        .from("time_entries")
        .update({
          approval_status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", entryIds)
        .eq("approval_status", "submitted")
        .select("id")

      if (error) throw error
      return NextResponse.json({ updated: data?.length || 0 })
    }

    if (action === "reject") {
      if (!note) {
        return NextResponse.json({ error: "Rejection note is required" }, { status: 400 })
      }
      const { data, error } = await db
        .from("time_entries")
        .update({
          approval_status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_note: note,
          updated_at: new Date().toISOString(),
        })
        .in("id", entryIds)
        .eq("approval_status", "submitted")
        .select("id")

      if (error) throw error
      return NextResponse.json({ updated: data?.length || 0 })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("[time-entries/approve] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

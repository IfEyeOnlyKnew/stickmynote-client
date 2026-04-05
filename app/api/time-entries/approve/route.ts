import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"

async function executeApprovalAction(
  db: any, action: string, entryIds: string[], userId: string, note?: string,
): Promise<NextResponse> {
  const now = new Date().toISOString()

  if (action === "submit") {
    const { data, error } = await db.from("time_entries")
      .update({ approval_status: "submitted", updated_at: now })
      .in("id", entryIds).eq("user_id", userId).eq("approval_status", "draft").select("id")
    if (error) throw error
    return NextResponse.json({ updated: data?.length || 0 })
  }

  if (action === "approve") {
    const { data, error } = await db.from("time_entries")
      .update({ approval_status: "approved", approved_by: userId, approved_at: now, updated_at: now })
      .in("id", entryIds).eq("approval_status", "submitted").select("id")
    if (error) throw error
    return NextResponse.json({ updated: data?.length || 0 })
  }

  if (action === "reject") {
    if (!note) return NextResponse.json({ error: "Rejection note is required" }, { status: 400 })
    const { data, error } = await db.from("time_entries")
      .update({ approval_status: "rejected", approved_by: userId, approved_at: now, rejection_note: note, updated_at: now })
      .in("id", entryIds).eq("approval_status", "submitted").select("id")
    if (error) throw error
    return NextResponse.json({ updated: data?.length || 0 })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

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

    return executeApprovalAction(db, action, entryIds, user.id, note)
  } catch (error) {
    console.error("[time-entries/approve] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

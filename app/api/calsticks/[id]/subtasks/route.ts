import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Constants
const SUBTASKS_SELECT = `
  id,
  stick_id,
  user_id,
  content,
  color,
  is_calstick,
  calstick_date,
  calstick_completed,
  calstick_completed_at,
  calstick_priority,
  calstick_status,
  calstick_assignee_id,
  calstick_labels,
  calstick_parent_id,
  calstick_estimated_hours,
  calstick_actual_hours,
  calstick_start_date,
  calstick_description,
  calstick_progress,
  calstick_checklist_items,
  created_at,
  updated_at
`

// Helper to attach user data to subtasks
async function attachUsersToSubtasks(db: any, subtasks: any[]) {
  if (!subtasks.length) return subtasks

  const userIds = [...new Set(subtasks.map((s: any) => s.user_id).filter(Boolean))]
  if (userIds.length === 0) return subtasks.map(s => ({ ...s, user: null }))

  const { data: users } = await db
    .from("users")
    .select("id, username, full_name, email")
    .in("id", userIds)

  const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]))

  return subtasks.map((s: any) => ({
    ...s,
    user: userMap[s.user_id] || null,
  }))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const parentId = id

    const { data: subtasks, error } = await db
      .from("paks_pad_stick_replies")
      .select(SUBTASKS_SELECT)
      .eq("calstick_parent_id", parentId)
      .eq("org_id", orgContext.orgId)
      .eq("is_calstick", true)
      .order("calstick_date", { ascending: true })

    if (error) {
      console.error("Error fetching subtasks:", error)
      return NextResponse.json({ error: "Failed to fetch subtasks" }, { status: 500 })
    }

    // Attach user data to subtasks
    const subtasksWithUsers = await attachUsersToSubtasks(db, subtasks || [])

    return NextResponse.json({ subtasks: subtasksWithUsers })
  } catch (error) {
    console.error("Error in subtasks GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

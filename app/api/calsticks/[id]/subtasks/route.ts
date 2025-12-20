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
  updated_at,
  user:users!paks_pad_stick_replies_user_id_fkey(
    id,
    username,
    full_name,
    email
  )
`

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const parentId = params.id

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

    return NextResponse.json({ subtasks: subtasks || [] })
  } catch (error) {
    console.error("Error in subtasks GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

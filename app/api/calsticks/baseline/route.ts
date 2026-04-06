import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

export const dynamic = "force-dynamic"

// ============================================================================
// Auth guard
// ============================================================================

interface AuthContext {
  db: any
  userId: string
  orgId: string
}

async function authenticateWithOrg(): Promise<{ auth: AuthContext } | { error: NextResponse }> {
  const [db, authResult] = await Promise.all([
    createServiceDatabaseClient(),
    getCachedAuthUser(),
  ])

  if (authResult.rateLimited) {
    return { error: NextResponse.json({ error: "Rate limit exceeded. Please try again in a moment." }, { status: 429, headers: { "Retry-After": "30" } }) }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }
  }

  return { auth: { db, userId: authResult.user.id, orgId: orgContext.orgId } }
}

// ============================================================================
// Baseline helpers
// ============================================================================

const BASELINE_NULL = { baseline_start_date: null, baseline_end_date: null, baseline_set_at: null }

async function setBaselineForTasks(db: any, tasks: any[]): Promise<number> {
  const now = new Date().toISOString()
  let updatedCount = 0
  for (const task of tasks) {
    const startDate = task.calstick_start_date || task.calstick_date
    const endDate = task.calstick_date || task.calstick_start_date
    const { error } = await db
      .from("paks_pad_stick_replies")
      .update({ baseline_start_date: startDate, baseline_end_date: endDate, baseline_set_at: now })
      .eq("id", task.id)
    if (!error) updatedCount++
  }
  return updatedCount
}

function isValidTaskIds(taskIds: unknown): taskIds is string[] {
  return Array.isArray(taskIds) && taskIds.length > 0
}

async function fetchCalstickTasks(
  db: any, orgId: string, filter: { setAll?: boolean; taskIds?: string[] },
): Promise<{ tasks: any[] | null; error: any }> {
  let query = db
    .from("paks_pad_stick_replies")
    .select("id, calstick_start_date, calstick_date")
    .eq("org_id", orgId)
    .eq("is_calstick", true)

  if (filter.setAll) {
    query = query.or("calstick_start_date.not.is.null,calstick_date.not.is.null")
  } else if (filter.taskIds) {
    query = query.in("id", filter.taskIds)
  }

  const { data, error } = await query
  return { tasks: data, error }
}

async function clearBaselines(db: any, orgId: string, taskIds?: string[]): Promise<{ error: any }> {
  let query = db
    .from("paks_pad_stick_replies")
    .update(BASELINE_NULL)
    .eq("org_id", orgId)

  if (taskIds) {
    query = query.in("id", taskIds)
  } else {
    query = query.eq("is_calstick", true).not("baseline_set_at", "is", null)
  }

  const { error } = await query
  return { error }
}

// ============================================================================
// POST: Set baseline for tasks (snapshot current dates as baseline)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateWithOrg()
    if ("error" in result) return result.error
    const { db, orgId } = result.auth

    const { taskIds, setAll } = await request.json()

    if (!setAll && !isValidTaskIds(taskIds)) {
      return NextResponse.json({ error: "taskIds array is required" }, { status: 400 })
    }

    const { tasks, error: fetchError } = await fetchCalstickTasks(db, orgId, { setAll, taskIds })
    if (fetchError) {
      console.error("[baseline] Fetch error:", fetchError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    const updatedCount = await setBaselineForTasks(db, tasks || [])
    return NextResponse.json({ success: true, updated: updatedCount, message: `Baseline set for ${updatedCount} tasks` })
  } catch (error) {
    console.error("[baseline] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE: Clear baselines for tasks
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const result = await authenticateWithOrg()
    if ("error" in result) return result.error
    const { db, orgId } = result.auth

    const { taskIds, clearAll } = await request.json()

    if (!clearAll && !isValidTaskIds(taskIds)) {
      return NextResponse.json({ error: "taskIds array is required" }, { status: 400 })
    }

    const { error } = await clearBaselines(db, orgId, clearAll ? undefined : taskIds)
    if (error) {
      console.error("[baseline] Clear error:", error)
      return NextResponse.json({ error: "Failed to clear baselines" }, { status: 500 })
    }

    const message = clearAll ? "All baselines cleared" : `Baselines cleared for ${taskIds.length} tasks`
    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error("[baseline] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

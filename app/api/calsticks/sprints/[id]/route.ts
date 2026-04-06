import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type { UpdateSprintInput } from "@/types/sprint"

export const dynamic = "force-dynamic"

// ============================================================================
// Auth guard shared across GET, PATCH, DELETE
// ============================================================================

interface SprintAuthContext {
  db: any
  orgId: string
}

async function authenticateSprintRequest(
  useServiceDb: boolean,
): Promise<{ auth: SprintAuthContext } | { error: NextResponse }> {
  const [db, authResult] = await Promise.all([
    useServiceDb ? createServiceDatabaseClient() : createDatabaseClient(),
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

  return { auth: { db, orgId: orgContext.orgId } }
}

// ============================================================================
// GET: Get a single sprint with tasks
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateSprintRequest(false)
    if ("error" in result) return result.error
    const { db, orgId } = result.auth

    const { searchParams } = new URL(request.url)
    const includeTasks = searchParams.get("includeTasks") === "true"

    const { data: sprint, error } = await db
      .from("sprints")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single()

    if (error || !sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    if (!includeTasks) {
      return NextResponse.json({ sprint })
    }

    const { data: tasks } = await db
      .from("paks_pad_stick_replies")
      .select(`
        id, stick_id, user_id, content, color, is_calstick,
        calstick_date, calstick_completed, calstick_completed_at,
        calstick_progress, calstick_status, calstick_priority,
        calstick_assignee_id, calstick_estimated_hours, calstick_actual_hours,
        calstick_start_date, social_stick_id, sprint_id, story_points,
        created_at, updated_at
      `)
      .eq("sprint_id", id)
      .eq("is_calstick", true)
      .eq("org_id", orgId)
      .order("calstick_priority", { ascending: true })

    return NextResponse.json({ sprint, tasks: tasks || [] })
  } catch (error) {
    console.error("[sprint] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH: Update a sprint
// ============================================================================

const SPRINT_UPDATE_FIELDS = ["name", "goal", "start_date", "end_date", "status", "velocity_planned", "velocity_completed"] as const

function buildSprintUpdateData(body: UpdateSprintInput): Record<string, any> {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const field of SPRINT_UPDATE_FIELDS) {
    if (body[field] !== undefined) updateData[field] = body[field]
  }
  return updateData
}

function hasInvalidDateRange(body: UpdateSprintInput): boolean {
  return !!(body.start_date && body.end_date && new Date(body.end_date) <= new Date(body.start_date))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateSprintRequest(true)
    if ("error" in result) return result.error
    const { db, orgId } = result.auth

    const body: UpdateSprintInput = await request.json()

    if (hasInvalidDateRange(body)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
    }

    const updateData = buildSprintUpdateData(body)
    const { data: sprint, error } = await db
      .from("sprints")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single()

    if (error) {
      console.error("[sprint] Update error:", error)
      return NextResponse.json({ error: "Failed to update sprint" }, { status: 500 })
    }
    if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 })

    return NextResponse.json({ sprint })
  } catch (error) {
    console.error("[sprint] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE: Delete a sprint (removes sprint_id from tasks but doesn't delete tasks)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateSprintRequest(true)
    if ("error" in result) return result.error
    const { db, orgId } = result.auth

    // Unlink all tasks from this sprint, then delete the sprint
    await db
      .from("paks_pad_stick_replies")
      .update({ sprint_id: null })
      .eq("sprint_id", id)
      .eq("org_id", orgId)

    const { error } = await db
      .from("sprints")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId)

    if (error) {
      console.error("[sprint] Delete error:", error)
      return NextResponse.json({ error: "Failed to delete sprint" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[sprint] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

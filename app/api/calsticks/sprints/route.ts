import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type { CreateSprintInput, Sprint } from "@/types/sprint"

export const dynamic = "force-dynamic"

// ============================================================================
// Auth guard shared across GET and POST
// ============================================================================

interface SprintsAuthContext {
  db: any
  userId: string
  orgId: string
}

async function authenticateSprintsRequest(
  useServiceDb: boolean,
): Promise<{ auth: SprintsAuthContext } | { error: NextResponse }> {
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

  return { auth: { db, userId: authResult.user.id, orgId: orgContext.orgId } }
}

// ============================================================================
// Stats helper
// ============================================================================

const EMPTY_STATS = { tasks_count: 0, completed_tasks_count: 0, total_story_points: 0, completed_story_points: 0 }

function accumulateTaskStats(statsMap: Record<string, typeof EMPTY_STATS>, task: any): void {
  if (!task.sprint_id) return
  if (!statsMap[task.sprint_id]) statsMap[task.sprint_id] = { ...EMPTY_STATS }
  const entry = statsMap[task.sprint_id]
  entry.tasks_count++
  entry.total_story_points += task.story_points || 0
  if (task.calstick_completed) {
    entry.completed_tasks_count++
    entry.completed_story_points += task.story_points || 0
  }
}

async function attachSprintStats(db: any, sprints: Sprint[]): Promise<any[]> {
  const sprintIds = sprints.map((s) => s.id)
  const { data: taskStats } = await db
    .from("paks_pad_stick_replies")
    .select("sprint_id, calstick_completed, story_points")
    .in("sprint_id", sprintIds)
    .eq("is_calstick", true)

  const statsMap: Record<string, typeof EMPTY_STATS> = {}
  for (const task of taskStats || []) {
    accumulateTaskStats(statsMap, task)
  }

  return sprints.map((sprint) => ({ ...sprint, ...(statsMap[sprint.id] || EMPTY_STATS) }))
}

// ============================================================================
// GET: List all sprints for the organization
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateSprintsRequest(false)
    if ("error" in result) return result.error
    const { db, orgId } = result.auth

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const includeStats = searchParams.get("includeStats") === "true"

    let query = db
      .from("sprints")
      .select("*")
      .eq("org_id", orgId)
      .order("start_date", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data: sprints, error } = await query

    if (error) {
      console.error("[sprints] Query error:", error)
      return NextResponse.json({ error: "Failed to fetch sprints" }, { status: 500 })
    }

    if (includeStats && sprints?.length) {
      const sprintsWithStats = await attachSprintStats(db, sprints)
      return NextResponse.json({ sprints: sprintsWithStats })
    }

    return NextResponse.json({ sprints })
  } catch (error) {
    console.error("[sprints] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST: Create a new sprint
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateSprintsRequest(true)
    if ("error" in result) return result.error
    const { db, userId, orgId } = result.auth

    const body: CreateSprintInput = await request.json()

    if (!body.name || !body.start_date || !body.end_date) {
      return NextResponse.json({ error: "Name, start_date, and end_date are required" }, { status: 400 })
    }

    if (new Date(body.end_date) <= new Date(body.start_date)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
    }

    const { data: sprint, error } = await db
      .from("sprints")
      .insert({
        org_id: orgId,
        name: body.name,
        goal: body.goal || null,
        start_date: body.start_date,
        end_date: body.end_date,
        velocity_planned: body.velocity_planned || 0,
        created_by: userId,
        status: "planning",
      })
      .select()
      .single()

    if (error) {
      console.error("[sprints] Create error:", error)
      return NextResponse.json({ error: "Failed to create sprint" }, { status: 500 })
    }

    return NextResponse.json({ sprint }, { status: 201 })
  } catch (error) {
    console.error("[sprints] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

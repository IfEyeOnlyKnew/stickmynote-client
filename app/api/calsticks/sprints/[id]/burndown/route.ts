import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { differenceInDays, parseISO, format, addDays, isBefore, isAfter } from "date-fns"
import type { Sprint, SprintBurndownSnapshot, SprintBurndownData } from "@/types/sprint"

export const dynamic = "force-dynamic"

// GET: Get burndown chart data for a sprint
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

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

    // Fetch sprint
    const { data: sprint, error: sprintError } = await db
      .from("sprints")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgContext.orgId)
      .single()

    if (sprintError || !sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // Fetch existing snapshots
    const { data: snapshots } = await db
      .from("sprint_burndown_snapshots")
      .select("*")
      .eq("sprint_id", id)
      .order("snapshot_date", { ascending: true })

    // Calculate current state from tasks
    const { data: tasks } = await db
      .from("paks_pad_stick_replies")
      .select("calstick_completed, story_points")
      .eq("sprint_id", id)
      .eq("is_calstick", true)
      .eq("org_id", orgContext.orgId)

    const currentStats = (tasks || []).reduce(
      (acc, task) => {
        acc.totalPoints += task.story_points || 0
        acc.totalTasks++
        if (task.calstick_completed) {
          acc.completedPoints += task.story_points || 0
          acc.completedTasks++
        }
        return acc
      },
      { totalPoints: 0, completedPoints: 0, totalTasks: 0, completedTasks: 0 },
    )

    // Generate ideal burndown line
    const startDate = parseISO(sprint.start_date)
    const endDate = parseISO(sprint.end_date)
    const totalDays = differenceInDays(endDate, startDate)
    const pointsPerDay = currentStats.totalPoints / Math.max(totalDays, 1)

    const idealBurndown: { date: string; points: number }[] = []
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(startDate, i)
      idealBurndown.push({
        date: format(date, "yyyy-MM-dd"),
        points: Math.max(0, currentStats.totalPoints - pointsPerDay * i),
      })
    }

    // Calculate days remaining
    const today = new Date()
    let daysRemaining = 0
    if (isBefore(today, endDate)) {
      daysRemaining = differenceInDays(endDate, today)
    }

    const burndownData: SprintBurndownData = {
      sprint: sprint as Sprint,
      snapshots: (snapshots || []) as SprintBurndownSnapshot[],
      idealBurndown,
      currentProgress: {
        totalPoints: currentStats.totalPoints,
        completedPoints: currentStats.completedPoints,
        remainingPoints: currentStats.totalPoints - currentStats.completedPoints,
        daysRemaining,
        percentComplete: currentStats.totalPoints > 0
          ? Math.round((currentStats.completedPoints / currentStats.totalPoints) * 100)
          : 0,
      },
    }

    return NextResponse.json(burndownData)
  } catch (error) {
    console.error("[burndown] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a snapshot for today (typically called by a cron job or manually)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [db, authResult] = await Promise.all([
      createServiceDatabaseClient(),
      getCachedAuthUser(),
    ])

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

    // Verify sprint exists
    const { data: sprint, error: sprintError } = await db
      .from("sprints")
      .select("id, status")
      .eq("id", id)
      .eq("org_id", orgContext.orgId)
      .single()

    if (sprintError || !sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // Calculate current state from tasks
    const { data: tasks } = await db
      .from("paks_pad_stick_replies")
      .select("calstick_completed, story_points")
      .eq("sprint_id", id)
      .eq("is_calstick", true)
      .eq("org_id", orgContext.orgId)

    const stats = (tasks || []).reduce(
      (acc, task) => {
        acc.totalPoints += task.story_points || 0
        acc.totalTasks++
        if (task.calstick_completed) {
          acc.completedPoints += task.story_points || 0
          acc.completedTasks++
        }
        return acc
      },
      { totalPoints: 0, completedPoints: 0, totalTasks: 0, completedTasks: 0 },
    )

    const today = format(new Date(), "yyyy-MM-dd")

    // Upsert snapshot (update if exists for today)
    const { data: snapshot, error } = await db
      .from("sprint_burndown_snapshots")
      .upsert(
        {
          sprint_id: id,
          snapshot_date: today,
          total_points: stats.totalPoints,
          completed_points: stats.completedPoints,
          remaining_points: stats.totalPoints - stats.completedPoints,
          tasks_total: stats.totalTasks,
          tasks_completed: stats.completedTasks,
        },
        { onConflict: "sprint_id,snapshot_date" },
      )
      .select()
      .single()

    if (error) {
      console.error("[burndown] Snapshot error:", error)
      return NextResponse.json({ error: "Failed to create snapshot" }, { status: 500 })
    }

    return NextResponse.json({ snapshot }, { status: 201 })
  } catch (error) {
    console.error("[burndown] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

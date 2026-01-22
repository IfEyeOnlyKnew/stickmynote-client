import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type { CreateSprintInput, Sprint } from "@/types/sprint"

export const dynamic = "force-dynamic"

// GET: List all sprints for the organization
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const includeStats = searchParams.get("includeStats") === "true"

    let query = db
      .from("sprints")
      .select("*")
      .eq("org_id", orgContext.orgId)
      .order("start_date", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data: sprints, error } = await query

    if (error) {
      console.error("[sprints] Query error:", error)
      return NextResponse.json({ error: "Failed to fetch sprints" }, { status: 500 })
    }

    // If includeStats, fetch task counts and story points for each sprint
    if (includeStats && sprints && sprints.length > 0) {
      const sprintIds = sprints.map((s: Sprint) => s.id)

      const { data: taskStats } = await db
        .from("paks_pad_stick_replies")
        .select("sprint_id, calstick_completed, story_points")
        .in("sprint_id", sprintIds)
        .eq("is_calstick", true)

      const statsMap: Record<string, {
        tasks_count: number
        completed_tasks_count: number
        total_story_points: number
        completed_story_points: number
      }> = {}

      for (const task of taskStats || []) {
        if (!task.sprint_id) continue
        if (!statsMap[task.sprint_id]) {
          statsMap[task.sprint_id] = {
            tasks_count: 0,
            completed_tasks_count: 0,
            total_story_points: 0,
            completed_story_points: 0,
          }
        }
        statsMap[task.sprint_id].tasks_count++
        statsMap[task.sprint_id].total_story_points += task.story_points || 0
        if (task.calstick_completed) {
          statsMap[task.sprint_id].completed_tasks_count++
          statsMap[task.sprint_id].completed_story_points += task.story_points || 0
        }
      }

      const sprintsWithStats = sprints.map((sprint: Sprint) => ({
        ...sprint,
        ...statsMap[sprint.id] || {
          tasks_count: 0,
          completed_tasks_count: 0,
          total_story_points: 0,
          completed_story_points: 0,
        },
      }))

      return NextResponse.json({ sprints: sprintsWithStats })
    }

    return NextResponse.json({ sprints })
  } catch (error) {
    console.error("[sprints] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a new sprint
export async function POST(request: NextRequest) {
  try {
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

    const body: CreateSprintInput = await request.json()

    // Validate required fields
    if (!body.name || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: "Name, start_date, and end_date are required" },
        { status: 400 },
      )
    }

    // Validate date range
    if (new Date(body.end_date) <= new Date(body.start_date)) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      )
    }

    const { data: sprint, error } = await db
      .from("sprints")
      .insert({
        org_id: orgContext.orgId,
        name: body.name,
        goal: body.goal || null,
        start_date: body.start_date,
        end_date: body.end_date,
        velocity_planned: body.velocity_planned || 0,
        created_by: authResult.user.id,
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

import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type { UpdateSprintInput } from "@/types/sprint"

export const dynamic = "force-dynamic"

// GET: Get a single sprint with tasks
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

    const { searchParams } = new URL(request.url)
    const includeTasks = searchParams.get("includeTasks") === "true"

    // Fetch sprint
    const { data: sprint, error } = await db
      .from("sprints")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgContext.orgId)
      .single()

    if (error || !sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // Optionally fetch tasks in this sprint
    if (includeTasks) {
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
        .eq("org_id", orgContext.orgId)
        .order("calstick_priority", { ascending: true })

      return NextResponse.json({ sprint, tasks: tasks || [] })
    }

    return NextResponse.json({ sprint })
  } catch (error) {
    console.error("[sprint] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: Update a sprint
export async function PATCH(
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

    const body: UpdateSprintInput = await request.json()

    // Build update object with only provided fields
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updateData.name = body.name
    if (body.goal !== undefined) updateData.goal = body.goal
    if (body.start_date !== undefined) updateData.start_date = body.start_date
    if (body.end_date !== undefined) updateData.end_date = body.end_date
    if (body.status !== undefined) updateData.status = body.status
    if (body.velocity_planned !== undefined) updateData.velocity_planned = body.velocity_planned
    if (body.velocity_completed !== undefined) updateData.velocity_completed = body.velocity_completed

    // Validate date range if both dates are being updated
    if (body.start_date && body.end_date) {
      if (new Date(body.end_date) <= new Date(body.start_date)) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 },
        )
      }
    }

    const { data: sprint, error } = await db
      .from("sprints")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      console.error("[sprint] Update error:", error)
      return NextResponse.json({ error: "Failed to update sprint" }, { status: 500 })
    }

    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    return NextResponse.json({ sprint })
  } catch (error) {
    console.error("[sprint] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a sprint (removes sprint_id from tasks but doesn't delete tasks)
export async function DELETE(
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

    // First, unlink all tasks from this sprint
    await db
      .from("paks_pad_stick_replies")
      .update({ sprint_id: null })
      .eq("sprint_id", id)
      .eq("org_id", orgContext.orgId)

    // Then delete the sprint
    const { error } = await db
      .from("sprints")
      .delete()
      .eq("id", id)
      .eq("org_id", orgContext.orgId)

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

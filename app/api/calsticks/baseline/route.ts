import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

export const dynamic = "force-dynamic"

// POST: Set baseline for tasks (snapshot current dates as baseline)
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

    const body = await request.json()
    const { taskIds, setAll } = body

    const now = new Date().toISOString()

    if (setAll) {
      // Set baseline for all tasks with dates
      const { data: tasks, error: fetchError } = await db
        .from("paks_pad_stick_replies")
        .select("id, calstick_start_date, calstick_date")
        .eq("org_id", orgContext.orgId)
        .eq("is_calstick", true)
        .or("calstick_start_date.not.is.null,calstick_date.not.is.null")

      if (fetchError) {
        console.error("[baseline] Fetch error:", fetchError)
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
      }

      let updatedCount = 0
      for (const task of tasks || []) {
        const startDate = task.calstick_start_date || task.calstick_date
        const endDate = task.calstick_date || task.calstick_start_date

        const { error: updateError } = await db
          .from("paks_pad_stick_replies")
          .update({
            baseline_start_date: startDate,
            baseline_end_date: endDate,
            baseline_set_at: now,
          })
          .eq("id", task.id)

        if (!updateError) updatedCount++
      }

      return NextResponse.json({
        success: true,
        updated: updatedCount,
        message: `Baseline set for ${updatedCount} tasks`,
      })
    }

    // Set baseline for specific tasks
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds array is required" },
        { status: 400 },
      )
    }

    const { data: tasks, error: fetchError } = await db
      .from("paks_pad_stick_replies")
      .select("id, calstick_start_date, calstick_date")
      .eq("org_id", orgContext.orgId)
      .eq("is_calstick", true)
      .in("id", taskIds)

    if (fetchError) {
      console.error("[baseline] Fetch error:", fetchError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    let updatedCount = 0
    for (const task of tasks || []) {
      const startDate = task.calstick_start_date || task.calstick_date
      const endDate = task.calstick_date || task.calstick_start_date

      const { error: updateError } = await db
        .from("paks_pad_stick_replies")
        .update({
          baseline_start_date: startDate,
          baseline_end_date: endDate,
          baseline_set_at: now,
        })
        .eq("id", task.id)

      if (!updateError) updatedCount++
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: `Baseline set for ${updatedCount} tasks`,
    })
  } catch (error) {
    console.error("[baseline] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Clear baselines for tasks
export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const { taskIds, clearAll } = body

    if (clearAll) {
      const { error } = await db
        .from("paks_pad_stick_replies")
        .update({
          baseline_start_date: null,
          baseline_end_date: null,
          baseline_set_at: null,
        })
        .eq("org_id", orgContext.orgId)
        .eq("is_calstick", true)
        .not("baseline_set_at", "is", null)

      if (error) {
        console.error("[baseline] Clear error:", error)
        return NextResponse.json({ error: "Failed to clear baselines" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "All baselines cleared",
      })
    }

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds array is required" },
        { status: 400 },
      )
    }

    const { error } = await db
      .from("paks_pad_stick_replies")
      .update({
        baseline_start_date: null,
        baseline_end_date: null,
        baseline_set_at: null,
      })
      .eq("org_id", orgContext.orgId)
      .in("id", taskIds)

    if (error) {
      console.error("[baseline] Clear error:", error)
      return NextResponse.json({ error: "Failed to clear baselines" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Baselines cleared for ${taskIds.length} tasks`,
    })
  } catch (error) {
    console.error("[baseline] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

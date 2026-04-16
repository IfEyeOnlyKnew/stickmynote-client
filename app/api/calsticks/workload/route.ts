import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all users with their capacity settings
    let { data: users, error: usersError } = await db
      .from("users")
      .select("id, full_name, email, hourly_rate_cents, capacity_hours_per_day")

    if (usersError?.code === "42703") {
      const { data: basicUsers, error: basicUsersError } = await db.from("users").select("id, full_name, email")

      if (basicUsersError) {
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
      }

      // Map to expected format with defaults
      users = (basicUsers || []).map((u) => ({
        ...u,
        hourly_rate_cents: 0,
        capacity_hours_per_day: 8,
      }))
      usersError = null
    } else if (usersError) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    // Get all tasks assigned to users within the date range
    const query = db
      .from("paks_pad_stick_replies")
      .select(`
        id,
        content,
        calstick_assignee_id,
        calstick_estimated_hours,
        calstick_actual_hours,
        calstick_date,
        calstick_status,
        calstick_priority
      `)
      .eq("is_calstick", true)
      .not("calstick_assignee_id", "is", null)

    if (start) {
      query.gte("calstick_date", start)
    }
    if (end) {
      query.lte("calstick_date", end)
    }

    const { data: tasks, error: tasksError } = await query

    if (tasksError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Group tasks by user
    const workloadData = ((users as any[]) || []).map((user) => ({
      userId: user.id,
      userName: user.full_name || user.email,
      email: user.email,
      capacityHoursPerDay: user.capacity_hours_per_day || 8,
      hourlyRateCents: user.hourly_rate_cents || 0,
      tasks: tasks
        .filter((task) => task.calstick_assignee_id === user.id)
        .map((task) => ({
          id: task.id,
          content: task.content,
          estimatedHours: task.calstick_estimated_hours || 0,
          actualHours: task.calstick_actual_hours || 0,
          dueDate: task.calstick_date,
          status: task.calstick_status || "todo",
          priority: task.calstick_priority || "none",
        })),
    }))

    return NextResponse.json({ users: workloadData })
  } catch (error) {
    console.error("[calsticks/workload] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function GET() {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Get tasks assigned to user that are in-progress or were updated today
    const { data: activeTasks, error: tasksError } = await db
      .from("paks_pad_stick_replies")
      .select("id, content, calstick_status, calstick_assignee_id, updated_at, stick_id")
      .eq("is_calstick", true)
      .eq("calstick_assignee_id", user.id)
      .eq("calstick_completed", false)
      .in("calstick_status", ["in-progress", "in-review"])
      .limit(20)

    if (tasksError) {
      // Table might not have new columns yet
      return NextResponse.json({ suggestions: [], staleTimers: [] })
    }

    // Get time entries logged today for this user
    const { data: todayEntries } = await db
      .from("time_entries")
      .select("task_id")
      .eq("user_id", user.id)
      .gte("started_at", todayStart.toISOString())
      .lte("started_at", todayEnd.toISOString())

    const loggedTaskIds = new Set((todayEntries || []).map((e: any) => e.task_id))

    // Filter to tasks with no time logged today
    const suggestions = (activeTasks || [])
      .filter((t: any) => !loggedTaskIds.has(t.id))
      .slice(0, 5)

    // Detect stale timers (running > 8 hours)
    const staleThreshold = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
    const { data: staleEntries } = await db
      .from("time_entries")
      .select("id, task_id, started_at")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .lte("started_at", staleThreshold)

    // Fetch stick names for suggestions
    const stickIds = [...new Set((suggestions || []).map((t: any) => t.stick_id).filter(Boolean))]
    let stickMap: Record<string, any> = {}
    if (stickIds.length > 0) {
      const { data: sticks } = await db
        .from("paks_pad_sticks")
        .select("id, topic")
        .in("id", stickIds)
      if (sticks) {
        stickMap = Object.fromEntries(sticks.map((s: any) => [s.id, s]))
      }
    }

    return NextResponse.json({
      suggestions: suggestions.map((t: any) => ({
        taskId: t.id,
        content: t.content,
        status: t.calstick_status,
        project: stickMap[t.stick_id]?.topic || null,
      })),
      staleTimers: (staleEntries || []).map((e: any) => ({
        entryId: e.id,
        taskId: e.task_id,
        startedAt: e.started_at,
      })),
    })
  } catch (error) {
    console.error("[time-entries/suggestions] Error:", error)
    return NextResponse.json({ suggestions: [], staleTimers: [] })
  }
}

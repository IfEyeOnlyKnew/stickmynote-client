import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"

async function enrichEntriesWithTasks(db: any, entries: any[]): Promise<any[]> {
  const taskIds = [...new Set(entries.map((e: any) => e.task_id).filter(Boolean))]
  if (taskIds.length === 0) return entries

  const { data: tasks } = await db.from("paks_pad_stick_replies").select("id, content, stick_id").in("id", taskIds)
  if (!tasks) return entries

  const taskMap: Record<string, any> = Object.fromEntries(tasks.map((t: any) => [t.id, t]))
  const stickIds = [...new Set(tasks.map((t: any) => t.stick_id).filter(Boolean))]
  let stickMap: Record<string, any> = {}

  if (stickIds.length > 0) {
    const { data: sticks } = await db.from("paks_pad_sticks").select("id, topic, content").in("id", stickIds)
    if (sticks) stickMap = Object.fromEntries(sticks.map((s: any) => [s.id, s]))
  }

  return entries.map((entry: any) => {
    const task = taskMap[entry.task_id]
    return {
      ...entry,
      task: task ? { id: task.id, content: task.content, stick: stickMap[task.stick_id] || null } : null,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
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
    const user = authResult.user

    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const taskId = searchParams.get("taskId")
    const approvalStatus = searchParams.get("approvalStatus")
    const userId = searchParams.get("userId")

    let query = db
      .from("time_entries")
      .select("*")
      .order("started_at", { ascending: false })

    // Filter by user - default to current user, but allow viewing team entries
    if (userId) {
      query = query.eq("user_id", userId)
    } else {
      query = query.eq("user_id", user.id)
    }

    if (start) {
      query = query.gte("started_at", start)
    }
    if (end) {
      query = query.lte("started_at", end)
    }
    if (taskId) {
      query = query.eq("task_id", taskId)
    }
    if (approvalStatus) {
      query = query.eq("approval_status", approvalStatus)
    }

    const { data: entries, error } = await query

    if (error) {
      if (error.code === "PGRST204" || error.message?.includes("Could not find the table")) {
        return NextResponse.json({
          entries: [],
          tableNotFound: true,
          message: "Time tracking tables not created. Please run scripts/add-calstick-phase2-fields.sql",
        })
      }
      throw error
    }

    const entriesWithTasks = await enrichEntriesWithTasks(db, entries || [])
    return NextResponse.json({ entries: entriesWithTasks })
  } catch (error) {
    console.error("Error fetching time entries:", error)
    return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
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
    const user = authResult.user

    const { taskId, startedAt, endedAt, durationSeconds, note, isBillable } = await request.json()

    if (!taskId || !startedAt) {
      return NextResponse.json({ error: "Task ID and start time are required" }, { status: 400 })
    }

    // Verify task exists
    const { data: task, error: taskError } = await db
      .from("paks_pad_stick_replies")
      .select("id, stick_id")
      .eq("id", taskId)
      .maybeSingle()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const insertData: Record<string, unknown> = {
      task_id: taskId,
      user_id: user.id,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      note,
    }
    if (isBillable !== undefined) {
      insertData.is_billable = isBillable
    }

    const { data: entry, error } = await db
      .from("time_entries")
      .insert(insertData)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          {
            error: "Time tracking tables not created",
            tableNotFound: true,
          },
          { status: 500 },
        )
      }
      throw error
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error creating time entry:", error)
    return NextResponse.json({ error: "Failed to create time entry" }, { status: 500 })
  }
}

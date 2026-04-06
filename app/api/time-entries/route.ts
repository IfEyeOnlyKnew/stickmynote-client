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

function applyTimeEntryFilters(
  query: any,
  filters: { userId: string | null; currentUserId: string; start: string | null; end: string | null; taskId: string | null; approvalStatus: string | null },
) {
  let q = query.eq("user_id", filters.userId || filters.currentUserId)

  if (filters.start) q = q.gte("started_at", filters.start)
  if (filters.end) q = q.lte("started_at", filters.end)
  if (filters.taskId) q = q.eq("task_id", filters.taskId)
  if (filters.approvalStatus) q = q.eq("approval_status", filters.approvalStatus)

  return q
}

function isTableNotFoundError(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST204" || !!error.message?.includes("Could not find the table")
}

function tableNotFoundResponse() {
  return NextResponse.json({
    entries: [],
    tableNotFound: true,
    message: "Time tracking tables not created. Please run scripts/add-calstick-phase2-fields.sql",
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
    const baseQuery = db.from("time_entries").select("*").order("started_at", { ascending: false })
    const query = applyTimeEntryFilters(baseQuery, {
      userId: searchParams.get("userId"),
      currentUserId: user.id,
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      taskId: searchParams.get("taskId"),
      approvalStatus: searchParams.get("approvalStatus"),
    })

    const { data: entries, error } = await query

    if (error) {
      if (isTableNotFoundError(error)) return tableNotFoundResponse()
      throw error
    }

    const entriesWithTasks = await enrichEntriesWithTasks(db, entries || [])
    return NextResponse.json({ entries: entriesWithTasks })
  } catch (error) {
    console.error("Error fetching time entries:", error)
    return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 })
  }
}

function buildInsertData(userId: string, body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {
    task_id: body.taskId,
    user_id: userId,
    started_at: body.startedAt,
    ended_at: body.endedAt,
    duration_seconds: body.durationSeconds,
    note: body.note,
  }
  if (body.isBillable !== undefined) {
    data.is_billable = body.isBillable
  }
  return data
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

    const body = await request.json()

    if (!body.taskId || !body.startedAt) {
      return NextResponse.json({ error: "Task ID and start time are required" }, { status: 400 })
    }

    const { data: task, error: taskError } = await db
      .from("paks_pad_stick_replies")
      .select("id, stick_id")
      .eq("id", body.taskId)
      .maybeSingle()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const { data: entry, error } = await db
      .from("time_entries")
      .insert(buildInsertData(user.id, body))
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ error: "Time tracking tables not created", tableNotFound: true }, { status: 500 })
      }
      throw error
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error creating time entry:", error)
    return NextResponse.json({ error: "Failed to create time entry" }, { status: 500 })
  }
}

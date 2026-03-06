import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { format } from "date-fns"

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    let query = db
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: true })

    if (start) query = query.gte("started_at", start)
    if (end) query = query.lte("started_at", end)

    const { data: entries, error } = await query
    if (error) throw error

    // Fetch task + stick data
    const taskIds = [...new Set((entries || []).map((e: any) => e.task_id).filter(Boolean))]
    let taskMap: Record<string, any> = {}
    let stickMap: Record<string, any> = {}

    if (taskIds.length > 0) {
      const { data: tasks } = await db
        .from("paks_pad_stick_replies")
        .select("id, content, stick_id")
        .in("id", taskIds)

      if (tasks) {
        taskMap = Object.fromEntries(tasks.map((t: any) => [t.id, t]))
        const stickIds = [...new Set(tasks.map((t: any) => t.stick_id).filter(Boolean))]
        if (stickIds.length > 0) {
          const { data: sticks } = await db
            .from("paks_pad_sticks")
            .select("id, topic")
            .in("id", stickIds)
          if (sticks) {
            stickMap = Object.fromEntries(sticks.map((s: any) => [s.id, s]))
          }
        }
      }
    }

    // Build CSV
    const headers = ["Date", "Task", "Project", "Hours", "Billable", "Status", "Note"]
    const rows = (entries || []).map((entry: any) => {
      const task = taskMap[entry.task_id]
      const stick = task ? stickMap[task.stick_id] : null
      const hours = entry.duration_seconds ? (entry.duration_seconds / 3600).toFixed(2) : "0.00"

      return [
        format(new Date(entry.started_at), "yyyy-MM-dd"),
        escapeCsvField(task?.content || "Untitled"),
        escapeCsvField(stick?.topic || "No Project"),
        hours,
        entry.is_billable ? "Yes" : "No",
        entry.approval_status || "draft",
        escapeCsvField(entry.note || ""),
      ].join(",")
    })

    const csv = [headers.join(","), ...rows].join("\n")

    const dateRange = start && end
      ? `${format(new Date(start), "yyyy-MM-dd")}_to_${format(new Date(end), "yyyy-MM-dd")}`
      : "all"

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="timesheet_${dateRange}.csv"`,
      },
    })
  } catch (error) {
    console.error("[time-entries/export] Error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}

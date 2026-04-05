import { NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
  try {
    const db = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { id: authResult.userId }

    // Fetch all CalSticks for the user
    const { data: tasks, error } = await db
      .from("paks_pad_stick_replies")
      .select(`
        id,
        content,
        calstick_date,
        calstick_start_date,
        calstick_status,
        calstick_priority,
        calstick_completed,
        calstick_completed_at,
        calstick_estimated_hours,
        calstick_actual_hours,
        calstick_labels,
        created_at,
        updated_at,
        stick_id
      `)
      .eq("is_calstick", true)
      .or(`user_id.eq.${user.id},calstick_assignee_id.eq.${user.id}`)
      .order("calstick_date", { ascending: false })

    if (error) throw error

    // Fetch related sticks and pads separately
    const stickIds = [...new Set((tasks || []).map((t: any) => t.stick_id).filter(Boolean))]
    let stickMap: Record<string, { topic?: string; pad_id?: string }> = {}
    let padMap: Record<string, { name?: string }> = {}

    if (stickIds.length > 0) {
      const { data: sticks } = await db
        .from("paks_pad_sticks")
        .select("id, topic, pad_id")
        .in("id", stickIds)

      if (sticks) {
        stickMap = Object.fromEntries(sticks.map((s: any) => [s.id, { topic: s.topic, pad_id: s.pad_id }]))

        // Fetch pads
        const padIds = [...new Set(sticks.map((s: any) => s.pad_id).filter(Boolean))]
        if (padIds.length > 0) {
          const { data: pads } = await db
            .from("paks_pads")
            .select("id, name")
            .in("id", padIds)

          if (pads) {
            padMap = Object.fromEntries(pads.map((p: any) => [p.id, { name: p.name }]))
          }
        }
      }
    }

    // Attach stick and pad data to tasks
    const tasksWithData = (tasks || []).map((task: any) => {
      const stick = stickMap[task.stick_id] || null
      return {
        ...task,
        stick: stick ? {
          topic: stick.topic,
          pad: stick.pad_id ? padMap[stick.pad_id] || null : null,
        } : null,
      }
    })

    // Generate CSV content
    const headers = [
      "Task ID",
      "Topic",
      "Content",
      "Project/Pad",
      "Status",
      "Priority",
      "Due Date",
      "Start Date",
      "Completed",
      "Completed At",
      "Est. Hours",
      "Actual Hours",
      "Labels",
    ]

    const csvRows = [headers.join(",")]

    tasksWithData.forEach((task: any) => {
      const row = [
        task.id,
        `"${(task.stick?.topic || "").replaceAll('"', '""')}"`,
        `"${(task.content || "").replaceAll('"', '""')}"`,
        `"${(task.stick?.pad?.name || "").replaceAll('"', '""')}"`,
        task.calstick_status || "todo",
        task.calstick_priority || "none",
        task.calstick_date ? new Date(task.calstick_date).toLocaleDateString() : "",
        task.calstick_start_date ? new Date(task.calstick_start_date).toLocaleDateString() : "",
        task.calstick_completed ? "Yes" : "No",
        task.calstick_completed_at ? new Date(task.calstick_completed_at).toLocaleString() : "",
        task.calstick_estimated_hours || "0",
        task.calstick_actual_hours || "0",
        `"${(task.calstick_labels || []).join("; ")}"`,
      ]
      csvRows.push(row.join(","))
    })

    const csvContent = csvRows.join("\n")

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="calsticks-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error exporting CSV:", error)
    return NextResponse.json({ error: "Failed to export CSV" }, { status: 500 })
  }
}

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
        stick:paks_pad_sticks(
          topic,
          pad:paks_pads(name)
        )
      `)
      .eq("is_calstick", true)
      .or(`user_id.eq.${user.id},calstick_assignee_id.eq.${user.id}`)
      .order("calstick_date", { ascending: false })

    if (error) throw error

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

    tasks?.forEach((task: any) => {
      const row = [
        task.id,
        `"${(task.stick?.topic || "").replace(/"/g, '""')}"`,
        `"${(task.content || "").replace(/"/g, '""')}"`,
        `"${(task.stick?.pad?.name || "").replace(/"/g, '""')}"`,
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

import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const serviceDb = await createServiceDatabaseClient()
    const { token } = params

    if (!token) {
      return new NextResponse("Missing token", { status: 400 })
    }

    // 1. Validate Token & Get User
    const { data: feed, error: feedError } = await serviceDb
      .from("paks_pad_calendar_feeds") // Updated table name to use paks_ prefix
      .select("user_id, filters")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle()

    if (feedError || !feed) {
      return new NextResponse("Invalid or inactive feed token", { status: 404 })
    }

    // 2. Fetch Tasks for User
    // We fetch CalSticks (stick_replies with is_calstick=true)
    // Filter by user_id (assigned or owned)
    const { data: tasks, error: tasksError } = await serviceDb
      .from("paks_pad_stick_replies") // Updated table name to use paks_ prefix
      .select(`
        id,
        content,
        calstick_date,
        calstick_start_date,
        calstick_status,
        calstick_priority,
        calstick_completed,
        updated_at,
        created_at,
        stick:paks_pad_sticks(
          topic,
          content
        )
      `)
      .eq("is_calstick", true)
      .or(`user_id.eq.${feed.user_id},calstick_assignee_id.eq.${feed.user_id}`)
      .eq("calstick_completed", false) // Default to active tasks only unless configured otherwise
      .order("calstick_date", { ascending: true })

    if (tasksError) {
      console.error("Error fetching tasks for feed:", tasksError)
      return new NextResponse("Internal Server Error", { status: 500 })
    }

    // 3. Generate iCal String
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//StickMyNote//CalSticks//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:My CalSticks",
      "X-WR-TIMEZONE:UTC",
    ]

    tasks?.forEach((task: any) => {
      if (!task.calstick_date) return // Skip tasks without dates

      const startDate = task.calstick_start_date ? new Date(task.calstick_start_date) : new Date(task.calstick_date)

      const endDate = new Date(task.calstick_date)

      // If no start date, assume 1 hour duration or all-day?
      // If start == end, it's a point in time.
      // Let's ensure end is at least start
      if (endDate < startDate) endDate.setTime(startDate.getTime() + 3600000)

      const startStr = startDate.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z"
      const endStr = endDate.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z"
      const dtStamp =
        new Date(task.updated_at || task.created_at).toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z"

      const summary = (task.stick?.topic || "Untitled Task").replace(/,/g, "\\,")
      const description = (task.content || "").replace(/\n/g, "\\n").replace(/,/g, "\\,")
      const priorityMap: Record<string, number> = { urgent: 1, high: 3, medium: 5, low: 7, none: 0 }
      const priority = priorityMap[task.calstick_priority] || 0

      icsContent.push(
        "BEGIN:VEVENT",
        `UID:${task.id}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `PRIORITY:${priority}`,
        `STATUS:${task.calstick_status?.toUpperCase().replace("-", "_") || "NEEDS_ACTION"}`,
        "END:VEVENT",
      )
    })

    icsContent.push("END:VCALENDAR")

    // 4. Update access stats
    await serviceDb
      .from("paks_pad_calendar_feeds")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("token", token) // Updated table name to use paks_ prefix

    return new NextResponse(icsContent.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="calsticks.ics"',
      },
    })
  } catch (error) {
    console.error("Error generating iCal feed:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)
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

    let query = supabase
      .from("paks_time_entries")
      .select(`
        *,
        task:paks_pad_stick_replies(
          id,
          content,
          stick:paks_pad_sticks(
            id,
            topic,
            content
          )
        )
      `)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })

    if (start) {
      query = query.gte("started_at", start)
    }
    if (end) {
      query = query.lte("started_at", end)
    }
    if (taskId) {
      query = query.eq("task_id", taskId)
    }

    const { data, error } = await query

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

    return NextResponse.json({ entries: data || [] })
  } catch (error) {
    console.error("Error fetching time entries:", error)
    return NextResponse.json({ error: "Failed to fetch time entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)
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

    const { taskId, startedAt, endedAt, durationSeconds, note } = await request.json()

    if (!taskId || !startedAt) {
      return NextResponse.json({ error: "Task ID and start time are required" }, { status: 400 })
    }

    const { data: task, error: taskError } = await supabase
      .from("paks_pad_stick_replies")
      .select(`
        id,
        stick:paks_pad_sticks(
          id,
          pad_id,
          pads:paks_pads(owner_id)
        )
      `)
      .eq("id", taskId)
      .maybeSingle()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const { data: entry, error } = await supabase
      .from("paks_time_entries")
      .insert({
        task_id: taskId,
        user_id: user.id,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        note,
      })
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

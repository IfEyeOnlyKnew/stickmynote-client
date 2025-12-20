import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: entry, error: fetchError } = await db
      .from("time_entries")
      .select("started_at, user_id, task_id")
      .eq("id", id)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!entry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 })
    }

    if (entry.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const endedAt = new Date()
    const startedAt = new Date(entry.started_at)
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    const { data, error } = await db
      .from("time_entries")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        updated_at: endedAt.toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle()

    if (error) throw error

    const hours = durationSeconds / 3600
    const { data: taskData } = await db
      .from("paks_pad_stick_replies")
      .select("calstick_actual_hours")
      .eq("id", entry.task_id)
      .maybeSingle()

    const currentHours = taskData?.calstick_actual_hours || 0
    await db
      .from("paks_pad_stick_replies")
      .update({
        calstick_actual_hours: currentHours + hours,
      })
      .eq("id", entry.task_id)

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error stopping timer:", error)
    return NextResponse.json({ error: "Failed to stop timer" }, { status: 500 })
  }
}

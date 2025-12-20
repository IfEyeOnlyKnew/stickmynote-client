import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId } = await request.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    // Check if there's already an active timer for this user
    const { data: activeEntries } = await db
      .from("time_entries")
      .select("id")
      .eq("user_id", user.id)
      .is("ended_at", null)

    if (activeEntries && activeEntries.length > 0) {
      return NextResponse.json({ error: "You already have an active timer running" }, { status: 400 })
    }

    // Create new time entry
    const { data, error } = await db
      .from("time_entries")
      .insert({
        task_id: taskId,
        user_id: user.id,
        started_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error starting timer:", error)
    return NextResponse.json({ error: "Failed to start timer" }, { status: 500 })
  }
}

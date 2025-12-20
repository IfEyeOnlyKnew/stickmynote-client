import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    let query = db.from("time_entries").select("*").eq("user_id", user.id).is("ended_at", null)

    if (taskId) {
      query = query.eq("task_id", taskId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      // If the table doesn't exist, return null activeEntry instead of throwing
      if (error.code === "PGRST116" || error.message?.includes("Could not find the table")) {
        console.warn("[v0] time_entries table not found. Please run scripts/add-calstick-phase2-fields.sql")
        return NextResponse.json({ activeEntry: null, tableExists: false })
      }
      throw error
    }

    return NextResponse.json({ activeEntry: data || null, tableExists: true })
  } catch (error) {
    console.error("Error checking active timer:", error)
    return NextResponse.json({ error: "Failed to check active timer" }, { status: 500 })
  }
}

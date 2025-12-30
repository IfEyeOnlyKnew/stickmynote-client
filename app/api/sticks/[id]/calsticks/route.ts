import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { type NextRequest, NextResponse } from "next/server"

// GET /api/sticks/[id]/calsticks - Get CalStick replies for a specific Stick
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all replies for this stick that have CalStick enabled
    const { data: replies, error } = await db
      .from("paks_pad_stick_replies")
      .select("id, content, is_calstick, calstick_date, calstick_completed, created_at, stick_id")
      .eq("stick_id", stickId)
      .eq("is_calstick", true)
      .order("calstick_date", { ascending: true })

    if (error) {
      console.error("Error fetching CalStick replies:", error)
      return NextResponse.json({ error: "Failed to fetch CalStick replies" }, { status: 500 })
    }

    const completed = replies?.filter((r) => r.calstick_completed).length || 0
    const notCompleted = replies?.filter((r) => !r.calstick_completed).length || 0

    return NextResponse.json({
      calsticks: replies || [],
      counts: {
        completed,
        notCompleted,
        total: replies?.length || 0,
      },
    })
  } catch (err) {
    console.error("GET /api/sticks/[id]/calsticks error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()
    const noteId = id

    const { data, error } = await db
      .from("personal_sticks_activities")
      .select("user_id", { count: "exact", head: false })
      .eq("personal_stick_id", noteId)
      .eq("activity_type", "view")

    if (error) {
      return NextResponse.json({ count: 0 })
    }

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ count: 0 })
    }

    // Count unique user views
    const uniqueUsers = new Set(data.map((d) => d.user_id))

    return NextResponse.json({ count: uniqueUsers.size })
  } catch (error) {
    console.error("[view-count] Error:", error)
    return NextResponse.json({ count: 0 })
  }
}

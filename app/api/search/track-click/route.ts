import { type NextRequest, NextResponse } from "next/server"
import { SearchAnalytics } from "@/lib/search-analytics"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, query, note_id, position } = body

    if (!user_id || !query || !note_id || position === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await SearchAnalytics.trackClick({
      user_id,
      query,
      note_id,
      position,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Track click error:", error)
    return NextResponse.json({ error: "Failed to track click" }, { status: 500 })
  }
}

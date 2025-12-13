import { createServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { NextResponse } from "next/server"

// POST /api/notifications/mark-all-read - Mark all activities as read
export async function POST(request: Request) {
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

    const { data: activities, error: fetchError } = await supabase
      .from("personal_sticks_activities")
      .select("id, metadata")
      .or("metadata->read.is.null,metadata->read.eq.false")

    if (fetchError) {
      console.error("Error fetching activities:", fetchError)
      return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 })
    }

    // Update each activity's metadata to mark as read
    const updates = activities.map((activity: { id: string; metadata: Record<string, unknown> | null }) => {
      const metadata = activity.metadata || {}
      metadata.read = true
      return supabase.from("personal_sticks_activities").update({ metadata }).eq("id", activity.id)
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in mark-all-read POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

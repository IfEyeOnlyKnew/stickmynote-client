import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// PATCH /api/notifications/[id] - Mark activity as read/unread
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const { id } = params
    const body = await request.json()
    const { read } = body

    if (typeof read !== "boolean") {
      return NextResponse.json({ error: "Invalid read status" }, { status: 400 })
    }

    const { data: activity, error: fetchError } = await supabase
      .from("personal_sticks_activities")
      .select("metadata")
      .eq("id", id)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching activity:", fetchError)
      return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 })
    }

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 })
    }

    const metadata = activity.metadata || {}
    metadata.read = read

    const { data, error } = await supabase
      .from("personal_sticks_activities")
      .update({ metadata })
      .eq("id", id)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error updating activity:", error)
      return NextResponse.json({ error: "Failed to update activity" }, { status: 500 })
    }

    return NextResponse.json({ notification: data })
  } catch (error) {
    console.error("Error in notification PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/notifications/[id] - Delete activity
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const { id } = params

    const { error } = await supabase.from("personal_sticks_activities").delete().eq("id", id)

    if (error) {
      console.error("Error deleting activity:", error)
      return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in notification DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

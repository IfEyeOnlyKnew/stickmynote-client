import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { runAutomationRules } from "@/lib/automation-engine"
import { CalstickCache } from "@/lib/calstick-cache"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServer()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const replyId = params.id
    const body = await request.json()

    const { data: previousTask } = await supabase
      .from("paks_pad_stick_replies")
      .select("*")
      .eq("id", replyId)
      .maybeSingle()

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (body.content !== undefined) updateData.content = body.content
    if (body.color !== undefined) updateData.color = body.color
    if (body.is_calstick !== undefined) updateData.is_calstick = body.is_calstick
    if (body.calstick_date !== undefined) updateData.calstick_date = body.calstick_date
    if (body.calstick_start_date !== undefined) updateData.calstick_start_date = body.calstick_start_date
    if (body.calstick_completed !== undefined) updateData.calstick_completed = body.calstick_completed
    if (body.calstick_completed_at !== undefined) updateData.calstick_completed_at = body.calstick_completed_at
    if (body.calstick_status !== undefined) updateData.calstick_status = body.calstick_status
    if (body.calstick_priority !== undefined) updateData.calstick_priority = body.calstick_priority
    if (body.calstick_assignee_id !== undefined) updateData.calstick_assignee_id = body.calstick_assignee_id
    if (body.calstick_estimated_hours !== undefined) updateData.calstick_estimated_hours = body.calstick_estimated_hours
    if (body.calstick_actual_hours !== undefined) updateData.calstick_actual_hours = body.calstick_actual_hours
    if (body.calstick_labels !== undefined) updateData.calstick_labels = body.calstick_labels
    if (body.calstick_description !== undefined) updateData.calstick_description = body.calstick_description
    if (body.calstick_progress !== undefined) updateData.calstick_progress = body.calstick_progress

    updateData.updated_at = new Date().toISOString()

    const { data: reply, error } = await supabase
      .from("paks_pad_stick_replies")
      .update(updateData)
      .eq("id", replyId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating paks_pad_stick_replies:", error)
      return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
    }

    await CalstickCache.invalidateUser(user.id)

    if (reply && previousTask) {
      // Determine which event(s) to trigger
      const events: Array<"task_updated" | "task_completed" | "status_changed" | "priority_changed"> = ["task_updated"]

      if (reply.calstick_completed && !previousTask.calstick_completed) {
        events.push("task_completed")
      }

      if (reply.calstick_status !== previousTask.calstick_status) {
        events.push("status_changed")
      }

      if (reply.calstick_priority !== previousTask.calstick_priority) {
        events.push("priority_changed")
      }

      // Run automation for each triggered event (async, don't block response)
      Promise.all(events.map((event) => runAutomationRules(event, reply, previousTask, user.id))).catch((err) =>
        console.error("[Automation] Error running rules:", err),
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error("[v0] Error in stick reply PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

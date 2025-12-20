import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { runAutomationRules } from "@/lib/automation-engine"
import { CalstickCache } from "@/lib/calstick-cache"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// Fields that can be updated via PATCH
const UPDATABLE_FIELDS = [
  "content",
  "color",
  "is_calstick",
  "calstick_date",
  "calstick_start_date",
  "calstick_completed",
  "calstick_completed_at",
  "calstick_status",
  "calstick_priority",
  "calstick_assignee_id",
  "calstick_estimated_hours",
  "calstick_actual_hours",
  "calstick_labels",
  "calstick_description",
  "calstick_progress",
] as const

type AutomationEvent = "task_updated" | "task_completed" | "status_changed" | "priority_changed"

/**
 * Build update object from request body, only including provided fields
 */
function buildUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {}
  
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }
  
  updateData.updated_at = new Date().toISOString()
  return updateData
}

/**
 * Determine which automation events to trigger based on changes
 */
function determineAutomationEvents(
  reply: Record<string, unknown>,
  previousTask: Record<string, unknown>
): AutomationEvent[] {
  const events: AutomationEvent[] = ["task_updated"]

  if (reply.calstick_completed && !previousTask.calstick_completed) {
    events.push("task_completed")
  }
  if (reply.calstick_status !== previousTask.calstick_status) {
    events.push("status_changed")
  }
  if (reply.calstick_priority !== previousTask.calstick_priority) {
    events.push("priority_changed")
  }

  return events
}

/**
 * Run automation rules for triggered events (non-blocking)
 */
function triggerAutomationRules(
  events: AutomationEvent[],
  reply: Record<string, unknown>,
  previousTask: Record<string, unknown>,
  userId: string
): void {
  Promise.all(
    events.map((event) => runAutomationRules(event, reply, previousTask, userId))
  ).catch((err) => console.error("[Automation] Error running rules:", err))
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }
    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const replyId = params.id
    const body = await request.json()
    const db = await createDatabaseClient()

    const { data: previousTask } = await db
      .from("paks_pad_stick_replies")
      .select("*")
      .eq("id", replyId)
      .maybeSingle()

    const updateData = buildUpdateData(body)

    const { data: reply, error } = await db
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
      const events = determineAutomationEvents(reply, previousTask)
      triggerAutomationRules(events, reply, previousTask, user.id)
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error("[v0] Error in stick reply PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

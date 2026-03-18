import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const { priority, dueDate, assigneeId } = body as {
      priority?: string
      dueDate?: string
      assigneeId?: string
    }

    // Get the social stick details (without nested join)
    const { data: stick, error: stickError } = await db
      .from("social_sticks")
      .select("id, topic, content, color, social_pad_id, user_id, org_id, calstick_id")
      .eq("id", stickId)
      .single()

    if (stickError || !stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Check if already promoted
    if (stick.calstick_id) {
      return NextResponse.json(
        {
          error: "Already promoted",
          calstickId: stick.calstick_id,
        },
        { status: 400 },
      )
    }

    // Find the parent stick for this social pad to link the CalStick
    const { data: parentStick } = await db
      .from("paks_pad_sticks")
      .select("id, pad_id")
      .eq("pad_id", stick.social_pad_id)
      .limit(1)
      .single()

    let stickIdForCalstick = parentStick?.id

    // If no parent stick exists, create one
    if (!stickIdForCalstick) {
      const { data: newStick, error: newStickError } = await db
        .from("paks_pad_sticks")
        .insert({
          topic: stick.topic,
          content: stick.content,
          color: stick.color,
          user_id: user.id,
          org_id: orgContext.orgId,
          pad_id: stick.social_pad_id,
        })
        .select("id")
        .single()

      if (!newStickError && newStick) {
        stickIdForCalstick = newStick.id
      }
    }

    const calstickData: Record<string, unknown> = {
      content: `[Promoted from Inference Hub] ${stick.topic || "Untitled"}\n\n${stick.content}`,
      color: stick.color,
      user_id: user.id,
      org_id: orgContext.orgId,
      is_calstick: true,
      calstick_status: "in-progress",
      calstick_priority: priority || "medium",
      calstick_completed: false,
      stick_id: stickIdForCalstick,
      social_stick_id: stickId,
    }

    if (dueDate) {
      calstickData.calstick_date = dueDate
    }
    if (assigneeId) {
      calstickData.calstick_assignee_id = assigneeId
    }

    const { data: calstick, error: calstickError } = await db
      .from("paks_pad_stick_replies")
      .insert(calstickData)
      .select("id")
      .single()

    if (calstickError) {
      console.error("[v0] Error creating CalStick:", calstickError)
      return NextResponse.json({ error: "Failed to create CalStick" }, { status: 500 })
    }

    // Update the social stick with the CalStick reference
    const { error: updateError } = await db
      .from("social_sticks")
      .update({
        calstick_id: calstick.id,
        workflow_status: "in_progress",
        promoted_at: new Date().toISOString(),
        promoted_by: user.id,
        workflow_updated_at: new Date().toISOString(),
      })
      .eq("id", stickId)

    if (updateError) {
      console.error("[v0] Error updating stick with CalStick reference:", updateError)
    }

    return NextResponse.json({
      success: true,
      calstickId: calstick.id,
      stickId: stickId,
    })
  } catch (error) {
    console.error("[v0] Error promoting to CalStick:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

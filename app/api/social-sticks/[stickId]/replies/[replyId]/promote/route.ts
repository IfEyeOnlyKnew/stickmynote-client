import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string; replyId: string }> }) {
  try {
    const { stickId, replyId } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const { data: reply, error: replyError } = await db
      .from("social_stick_replies")
      .select("id, content, color, social_stick_id, user_id, org_id, calstick_id")
      .eq("id", replyId)
      .eq("social_stick_id", stickId)
      .maybeSingle()

    if (replyError || !reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    // Check if already promoted
    if (reply.calstick_id) {
      return NextResponse.json(
        {
          error: "Already promoted",
          calstickId: reply.calstick_id,
        },
        { status: 400 },
      )
    }

    const { data: socialStick, error: stickError } = await db
      .from("social_sticks")
      .select("id, topic, social_pad_id")
      .eq("id", stickId)
      .maybeSingle()

    if (stickError || !socialStick) {
      return NextResponse.json({ error: "Parent stick not found" }, { status: 404 })
    }

    const { data: parentStick } = await db
      .from("paks_pad_sticks")
      .select("id, pad_id")
      .eq("pad_id", socialStick.social_pad_id)
      .limit(1)
      .maybeSingle()

    let stickIdForCalstick = parentStick?.id

    // If no parent stick exists, create one
    if (!stickIdForCalstick) {
      const { data: newStick, error: newStickError } = await db
        .from("paks_pad_sticks")
        .insert({
          topic: `Social: ${socialStick.topic || "Untitled"}`,
          content: reply.content,
          color: reply.color,
          user_id: user.id,
          org_id: orgContext.orgId,
          pad_id: socialStick.social_pad_id,
        })
        .select("id")
        .maybeSingle()

      if (!newStickError && newStick) {
        stickIdForCalstick = newStick.id
      }
    }

    const calstickContent = `[Promoted from Social Hub Reply]\nTopic: ${socialStick.topic || "Untitled"}\n\nReply Content:\n${reply.content}`

    const calstickData: Record<string, unknown> = {
      content: calstickContent,
      color: reply.color,
      user_id: user.id,
      org_id: orgContext.orgId,
      is_calstick: true,
      calstick_status: "in-progress",
      calstick_priority: priority || "medium",
      calstick_completed: false,
      stick_id: stickIdForCalstick,
      social_stick_id: stickId,
      social_stick_reply_id: replyId,
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
      .maybeSingle()

    if (calstickError || !calstick) {
      console.error("[v0] Error creating CalStick:", calstickError)
      return NextResponse.json({ error: "Failed to create CalStick" }, { status: 500 })
    }

    // Update the social stick reply with the CalStick reference
    const { error: updateError } = await db
      .from("social_stick_replies")
      .update({
        calstick_id: calstick.id,
        promoted_at: new Date().toISOString(),
        promoted_by: user.id,
      })
      .eq("id", replyId)

    if (updateError) {
      console.error("[v0] Error updating reply with CalStick reference:", updateError)
    }

    return NextResponse.json({
      success: true,
      calstickId: calstick.id,
      replyId: replyId,
      stickId: stickId,
    })
  } catch (error) {
    console.error("[v0] Error promoting reply to CalStick:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

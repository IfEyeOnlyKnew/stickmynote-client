import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

async function findOrCreatePaksPad(db: any, padName: string, userId: string, orgId: string): Promise<string | undefined> {
  const { data: existing } = await db
    .from("paks_pads").select("id")
    .eq("owner_id", userId).eq("org_id", orgId).eq("name", padName)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await db
    .from("paks_pads")
    .insert({ name: padName, owner_id: userId, org_id: orgId })
    .select("id").maybeSingle()

  if (error) console.error("[v0] Error creating paks_pad:", error)
  return created?.id
}

async function findOrCreateParentStick(
  db: any, paksPadId: string, userId: string, orgId: string,
  topic: string | null, reply: { content: string; color: string },
): Promise<string | undefined> {
  const { data: existing } = await db
    .from("paks_pad_sticks").select("id")
    .eq("pad_id", paksPadId).eq("user_id", userId)
    .limit(1).maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await db
    .from("paks_pad_sticks")
    .insert({
      topic: `Social: ${topic || "Untitled"}`,
      content: reply.content, color: reply.color,
      user_id: userId, org_id: orgId, pad_id: paksPadId,
    })
    .select("id").maybeSingle()

  if (error) console.error("[v0] Error creating paks_pad_stick:", error)
  return created?.id
}

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

    const { data: inferenceStick, error: stickError } = await db
      .from("social_sticks")
      .select("id, topic, social_pad_id")
      .eq("id", stickId)
      .maybeSingle()

    if (stickError || !inferenceStick) {
      return NextResponse.json({ error: "Parent stick not found" }, { status: 404 })
    }

    // Get the social pad name to use for the paks_pad
    const { data: inferencePad, error: inferencePadError } = await db
      .from("social_pads")
      .select("id, name")
      .eq("id", inferenceStick.social_pad_id)
      .maybeSingle()

    if (inferencePadError || !inferencePad) {
      return NextResponse.json({ error: "Social pad not found" }, { status: 404 })
    }

    const padName = inferencePad.name || "CalSticks"

    // Find or create a paks_pad with the same name as the social pad
    const paksPadId = await findOrCreatePaksPad(db, padName, user.id, orgContext.orgId)
    if (!paksPadId) {
      return NextResponse.json({ error: "Could not find or create CalStick pad" }, { status: 500 })
    }

    // Find or create a paks_pad_sticks entry
    const stickIdForCalstick = await findOrCreateParentStick(
      db, paksPadId, user.id, orgContext.orgId, inferenceStick.topic, reply,
    )
    if (!stickIdForCalstick) {
      return NextResponse.json({ error: "Could not find or create CalStick parent" }, { status: 500 })
    }

    // Use reply content directly - the Topic is shown separately in the Task Details form
    const calstickContent = reply.content

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

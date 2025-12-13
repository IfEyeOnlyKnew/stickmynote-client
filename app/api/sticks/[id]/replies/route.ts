import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

async function safeGetOrgContext(userId: string) {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { rateLimited: true as const }
    }
    throw error
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const stickId = params.id
    const adminClient = createServiceClient()

    const { data: stick, error: stickError } = await adminClient
      .from("paks_pad_sticks")
      .select("pad_id")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stickError || !stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // 2. Check if user has access to the pad (Owner or Member)
    const [padResult, memberResult] = await Promise.all([
      adminClient
        .from("paks_pads")
        .select("owner_id")
        .eq("id", stick.pad_id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle(),
      adminClient
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", stick.pad_id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ])

    const isOwner = padResult.data?.owner_id === user.id
    const isMember = !!memberResult.data

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: replies, error } = await adminClient
      .from("paks_pad_stick_replies")
      .select(`
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        is_calstick,
        calstick_date,
        calstick_completed,
        calstick_completed_at,
        user:users(username, email, full_name)
      `)
      .eq("stick_id", stickId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching stick replies:", error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    return NextResponse.json({ replies: replies || [] })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("Error in stick replies GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const stickId = params.id
    const {
      content,
      color = "#fef3c7",
      is_calstick = false,
      calstick_date = null,
      calstick_status = null,
      calstick_priority = null,
      calstick_parent_id = null,
      calstick_assignee_id = null,
    } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const adminClient = createServiceClient()

    const { data: stick, error: stickError } = await adminClient
      .from("paks_pad_sticks")
      .select("pad_id")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stickError || !stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // 2. Check permissions
    const [padResult, memberResult] = await Promise.all([
      adminClient
        .from("paks_pads")
        .select("owner_id")
        .eq("id", stick.pad_id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle(),
      adminClient
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", stick.pad_id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ])

    const isOwner = padResult.data?.owner_id === user.id
    const isMember = !!memberResult.data

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: reply, error } = await adminClient
      .from("paks_pad_stick_replies")
      .insert({
        stick_id: stickId,
        user_id: user.id,
        org_id: orgContext.orgId,
        content: content.trim(),
        color,
        is_calstick,
        calstick_date,
        calstick_status,
        calstick_priority,
        calstick_parent_id,
        calstick_assignee_id,
      })
      .select(`
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        is_calstick,
        calstick_date,
        calstick_completed,
        calstick_completed_at,
        user:users(username, email, full_name)
      `)
      .single()

    if (error) {
      console.error("Error creating stick reply:", error)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("Error in stick replies POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const { replyId, content, color } = await request.json()

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const adminClient = createServiceClient()

    // Fetch the existing reply to verify ownership
    const { data: existingReply, error: replyError } = await adminClient
      .from("paks_pad_stick_replies")
      .select("user_id, org_id")
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (replyError || !existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    // Only the reply author can edit their reply
    if (existingReply.user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own replies" }, { status: 403 })
    }

    // Build update data
    const updateData: Record<string, string> = {
      content: content.trim(),
      updated_at: new Date().toISOString(),
    }
    if (color !== undefined) {
      updateData.color = color
    }

    const { data: reply, error } = await adminClient
      .from("paks_pad_stick_replies")
      .update(updateData)
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .select(`
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        is_calstick,
        calstick_date,
        calstick_completed,
        calstick_completed_at,
        user:users(username, email, full_name)
      `)
      .single()

    if (error) {
      console.error("Error updating stick reply:", error)
      return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("Error in stick replies PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const stickId = params.id
    const { replyId } = await request.json()

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    const adminClient = createServiceClient()

    const { data: reply, error: replyError } = await adminClient
      .from("paks_pad_stick_replies")
      .select("user_id, stick_id")
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (replyError || !reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    if (reply.user_id === user.id) {
      // User owns the reply, allow delete
      const { error } = await adminClient
        .from("paks_pad_stick_replies")
        .delete()
        .eq("id", replyId)
        .eq("org_id", orgContext.orgId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Check if user is pad owner
    const { data: stick } = await adminClient
      .from("paks_pad_sticks")
      .select("pad_id")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stick) {
      const { data: pad } = await adminClient
        .from("paks_pads")
        .select("owner_id")
        .eq("id", stick.pad_id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (pad && pad.owner_id === user.id) {
        // User is pad owner, allow delete
        const { error } = await adminClient
          .from("paks_pad_stick_replies")
          .delete()
          .eq("id", replyId)
          .eq("org_id", orgContext.orgId)
        if (error) throw error
        return NextResponse.json({ success: true })
      }
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("Error in stick replies DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

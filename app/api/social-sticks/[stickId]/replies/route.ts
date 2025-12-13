import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service-client"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

type User = {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
}

type StickWithPad = {
  social_pad_id: string
  social_pads: { owner_id: string }[] | null
}

export async function GET(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const { stickId } = params

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    const repliesQuery = supabase
      .from("social_stick_replies")
      .select("*")
      .eq("social_stick_id", stickId)
      .order("created_at", { ascending: false })

    if (orgContext) {
      repliesQuery.eq("org_id", orgContext.orgId)
    }

    const { data: replies, error } = await repliesQuery

    if (error) {
      console.error("[v0] Error fetching replies:", error)
      throw error
    }

    if (replies && replies.length > 0) {
      const userIds = [...new Set(replies.map((r) => r.user_id))]
      const serviceClient = createServiceClient()

      const { data: users } = await serviceClient
        .from("users")
        .select("id, full_name, username, email, avatar_url")
        .in("id", userIds)
        .returns<User[]>()

      const userMap = new Map(users?.map((u) => [u.id, u]) || [])

      const repliesWithUsers = replies.map((reply) => ({
        ...reply,
        users: userMap.get(reply.user_id) || null,
      }))

      return NextResponse.json({ replies: repliesWithUsers })
    }

    return NextResponse.json({ replies: [] })
  } catch (error) {
    console.error("[v0] Error fetching replies:", error)
    return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { stickId } = params
    const { content, color, parent_reply_id, category } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Reply content is required" }, { status: 400 })
    }

    const { data: stick, error: stickError } = await supabase
      .from("social_sticks")
      .select("social_pad_id, social_pads(owner_id)")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stickError) {
      console.error("[v0] Error fetching stick:", stickError)
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const typedStick = stick as StickWithPad
    const isOwner = typedStick.social_pads?.[0]?.owner_id === user.id

    if (!isOwner) {
      const { data: membership, error: membershipError } = await supabase
        .from("social_pad_members")
        .select("role")
        .eq("social_pad_id", stick.social_pad_id)
        .eq("user_id", user.id)
        .eq("accepted", true)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (membershipError) {
        console.error("[v0] Error checking membership:", membershipError)
        return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
      }

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      if (membership.role === "viewer") {
        return NextResponse.json({ error: "Viewers cannot reply to sticks" }, { status: 403 })
      }
    }

    const { data: reply, error: insertError } = await supabase
      .from("social_stick_replies")
      .insert({
        social_stick_id: stickId,
        user_id: user.id,
        content: content.trim(),
        color: color || "#fef3c7",
        parent_reply_id: parent_reply_id || null,
        category: category || "Answer",
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Error inserting reply:", insertError)
      return NextResponse.json({ error: "Failed to insert reply", details: insertError.message }, { status: 500 })
    }

    if (!reply) {
      console.error("[v0] No reply returned after insert")
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    const serviceClient = createServiceClient()
    const { data: userData, error: userError } = await serviceClient
      .from("users")
      .select("id, full_name, username, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle()

    if (userError) {
      console.error("[v0] Error fetching user data:", userError)
    }

    const replyWithUser = {
      ...reply,
      users: userData || null,
    }

    return NextResponse.json({ reply: replyWithUser })
  } catch (error) {
    console.error("[v0] Error creating reply:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to create reply", details: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { reply_id, content } = await request.json()

    if (!reply_id || !content?.trim()) {
      return NextResponse.json({ error: "Reply ID and content are required" }, { status: 400 })
    }

    const { data: existingReply } = await supabase
      .from("social_stick_replies")
      .select("user_id")
      .eq("id", reply_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    if (existingReply.user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own replies" }, { status: 403 })
    }

    const { data: updatedReply, error } = await supabase
      .from("social_stick_replies")
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reply_id)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating reply:", error)
      throw error
    }

    return NextResponse.json({ reply: updatedReply })
  } catch (error) {
    console.error("[v0] Error updating reply:", error)
    return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { stickId } = params
    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get("replyId")

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    const { data: stick } = await supabase
      .from("social_sticks")
      .select("social_pad_id, social_pads(owner_id)")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const isPadOwner = stick.social_pads?.[0]?.owner_id === user.id

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const isAdmin = membership?.role === "admin"

    const { data: reply } = await supabase
      .from("social_stick_replies")
      .select("user_id")
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    const canDelete = reply.user_id === user.id || isPadOwner || isAdmin

    if (!canDelete) {
      return NextResponse.json({ error: "You don't have permission to delete this reply" }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from("social_stick_replies")
      .delete()
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)

    if (deleteError) {
      console.error("[v0] Error deleting reply:", deleteError)
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting reply:", error)
    return NextResponse.json({ error: "Failed to delete reply" }, { status: 500 })
  }
}

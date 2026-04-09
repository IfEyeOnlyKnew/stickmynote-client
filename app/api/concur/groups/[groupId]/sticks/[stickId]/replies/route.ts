import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
}

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[ConcurStickReplies]"
const DEFAULT_REPLY_COLOR = "#fef3c7"
const USER_SELECT_FIELDS = "id, full_name, username, email, avatar_url"

// ============================================================================
// Auth & Access Helpers
// ============================================================================

async function getAuthAndMembership(groupId: string) {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { response: createRateLimitResponse() }
  if (!user) return { response: createUnauthorizedResponse() }

  const orgContext = await getOrgContext()
  if (!orgContext) return { response: NextResponse.json({ error: "No organization context" }, { status: 403 }) }

  const db = await createDatabaseClient()
  const serviceDb = await createServiceDatabaseClient()

  const { data: membership } = await db
    .from("concur_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("org_id", orgContext.orgId)
    .maybeSingle()

  if (!membership) return { response: NextResponse.json({ error: "Access denied" }, { status: 403 }) }

  return { user, orgContext, db, serviceDb, membership }
}

// ============================================================================
// GET - List replies for a stick (threaded)
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId, stickId } = await params
    const auth = await getAuthAndMembership(groupId)
    if ("response" in auth) return auth.response
    const { orgContext, db, serviceDb } = auth

    // Fetch all replies for this stick
    const { data: replies, error } = await db
      .from("concur_stick_replies")
      .select("*")
      .eq("stick_id", stickId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error(`${LOG_PREFIX} Error fetching replies:`, error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    if (!replies || replies.length === 0) {
      return NextResponse.json({ replies: [] })
    }

    // Enrich with user data
    const userIds = [...new Set(replies.map((r: any) => r.user_id))] as string[]
    const { data: users } = await serviceDb
      .from("users")
      .select(USER_SELECT_FIELDS)
      .in("id", userIds)

    const userMap = new Map((users || []).map((u: User) => [u.id, u]))

    const repliesWithUsers = replies.map((reply: any) => ({
      ...reply,
      users: userMap.get(reply.user_id) || null,
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create a reply (members only, supports threading)
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId, stickId } = await params
    const auth = await getAuthAndMembership(groupId)
    if ("response" in auth) return auth.response
    const { user, orgContext, db, serviceDb } = auth

    // Verify stick exists in this group
    const { data: stick } = await db
      .from("concur_sticks")
      .select("id")
      .eq("id", stickId)
      .eq("group_id", groupId)
      .maybeSingle()

    if (!stick) return NextResponse.json({ error: "Stick not found" }, { status: 404 })

    const { content, color, parent_reply_id, category } = await request.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: "Reply content is required" }, { status: 400 })
    }

    // Insert reply
    const { data: reply, error } = await db
      .from("concur_stick_replies")
      .insert({
        stick_id: stickId,
        user_id: user.id,
        org_id: orgContext.orgId,
        content: content.trim(),
        color: color || DEFAULT_REPLY_COLOR,
        parent_reply_id: parent_reply_id || null,
        category: category || null,
      })
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error creating reply:`, error)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    // Fetch user data for response
    const { data: userData } = await serviceDb
      .from("users")
      .select(USER_SELECT_FIELDS)
      .eq("id", user.id)
      .maybeSingle()

    // Broadcast
    publishToOrg(orgContext.orgId, {
      type: "concur.reply_created",
      payload: { groupId, stickId, replyId: reply.id, userId: user.id },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      reply: { ...reply, users: userData },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
  }
}

// ============================================================================
// PUT - Edit a reply (author only)
// ============================================================================

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId } = await params
    const auth = await getAuthAndMembership(groupId)
    if ("response" in auth) return auth.response
    const { user, orgContext, db } = auth

    const { reply_id, content } = await request.json()
    if (!reply_id || !content?.trim()) {
      return NextResponse.json({ error: "Reply ID and content are required" }, { status: 400 })
    }

    // Check ownership
    const { data: existing } = await db
      .from("concur_stick_replies")
      .select("user_id")
      .eq("id", reply_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own replies" }, { status: 403 })
    }

    const { data: reply, error } = await db
      .from("concur_stick_replies")
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", reply_id)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error updating reply:`, error)
      return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error(`${LOG_PREFIX} PUT error:`, error)
    return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete a reply (author or group owner)
// ============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId } = await params
    const auth = await getAuthAndMembership(groupId)
    if ("response" in auth) return auth.response
    const { user, orgContext, db, membership } = auth

    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get("replyId")
    if (!replyId) return NextResponse.json({ error: "replyId is required" }, { status: 400 })

    // Check reply ownership
    const { data: reply } = await db
      .from("concur_stick_replies")
      .select("user_id")
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 })

    if (reply.user_id !== user.id && membership.role !== "owner") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error } = await db
      .from("concur_stick_replies")
      .delete()
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error(`${LOG_PREFIX} Error deleting reply:`, error)
      return NextResponse.json({ error: "Failed to delete reply" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE error:`, error)
    return NextResponse.json({ error: "Failed to delete reply" }, { status: 500 })
  }
}

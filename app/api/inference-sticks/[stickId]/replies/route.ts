import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext, type OrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"

// ============================================================================
// Types
// ============================================================================

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

type ReplyInput = {
  content: string
  color?: string
  parent_reply_id?: string
  category?: string
}

// ============================================================================
// Constants
// ============================================================================

const USER_SELECT_FIELDS = "id, full_name, username, email, avatar_url"
const DEFAULT_REPLY_COLOR = "#fef3c7"
const DEFAULT_CATEGORY = "Answer"
const LOG_PREFIX = "[InferenceStickReplies]"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  orgRequired: () => NextResponse.json({ error: "Organization context required" }, { status: 401 }),
  contentRequired: () => NextResponse.json({ error: "Reply content is required" }, { status: 400 }),
  stickNotFound: () => NextResponse.json({ error: "Stick not found" }, { status: 404 }),
  accessDenied: () => NextResponse.json({ error: "Access denied" }, { status: 403 }),
  viewerNoReply: () => NextResponse.json({ error: "Viewers cannot reply to sticks" }, { status: 403 }),
  verifyFailed: () => NextResponse.json({ error: "Failed to verify access" }, { status: 500 }),
  insertFailed: (msg?: string) => NextResponse.json({ error: "Failed to insert reply", details: msg }, { status: 500 }),
  createFailed: () => NextResponse.json({ error: "Failed to create reply" }, { status: 500 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 }),
}

// ============================================================================
// Auth Helpers
// ============================================================================

async function getAuthenticatedUser() {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) return { error: "RATE_LIMITED" as const }
  if (!authResult.user) return { error: "UNAUTHORIZED" as const }
  return { user: authResult.user }
}

async function getOrgContextSafe(): Promise<{ orgContext: OrgContext } | { error: "RATE_LIMITED" | "NO_ORG" }> {
  try {
    const orgContext = await getOrgContext()
    if (!orgContext) return { error: "NO_ORG" }
    return { orgContext }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "RATE_LIMITED") return { error: "RATE_LIMITED" }
    throw err
  }
}

type AuthenticatedContext = {
  user: { id: string; email?: string }
  orgContext: OrgContext
}

async function getAuthenticatedContext(): Promise<
  | { success: true; context: AuthenticatedContext }
  | { success: false; response: NextResponse }
> {
  const authResult = await getAuthenticatedUser()
  if ("error" in authResult) {
    return {
      success: false,
      response: authResult.error === "RATE_LIMITED" ? Errors.rateLimit() : Errors.unauthorized(),
    }
  }

  const orgResult = await getOrgContextSafe()
  if ("error" in orgResult) {
    return {
      success: false,
      response: orgResult.error === "RATE_LIMITED" ? Errors.rateLimit() : Errors.orgRequired(),
    }
  }

  return {
    success: true,
    context: { user: authResult.user, orgContext: orgResult.orgContext },
  }
}

// ============================================================================
// Database Operations
// ============================================================================

async function fetchRepliesForStick(db: any, stickId: string, orgId?: string) {
  const query = db
    .from("social_stick_replies")
    .select("*")
    .eq("social_stick_id", stickId)
    .order("created_at", { ascending: false })

  if (orgId) {
    query.eq("org_id", orgId)
  }

  return query
}

async function fetchUsersForReplies(serviceDb: any, userIds: string[]): Promise<Map<string, User>> {
  const { data: users } = await serviceDb
    .from("users")
    .select(USER_SELECT_FIELDS)
    .in("id", userIds)

  return new Map((users as User[] | null)?.map((u) => [u.id, u]) || [])
}

async function fetchStickWithPad(db: any, stickId: string, orgId: string) {
  const { data: stick, error } = await db
    .from("social_sticks")
    .select("social_pad_id")
    .eq("id", stickId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !stick) {
    return { data: null, error }
  }

  // Fetch pad owner separately
  if (stick.social_pad_id) {
    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", stick.social_pad_id)
      .maybeSingle()
    stick.social_pads = pad
  }

  return { data: stick, error: null }
}

async function fetchMembership(db: any, padId: string, userId: string, orgId: string) {
  return db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("accepted", true)
    .eq("org_id", orgId)
    .maybeSingle()
}

async function insertReply(db: any, data: {
  stickId: string
  userId: string
  content: string
  color: string
  parentReplyId: string | null
  category: string
  orgId: string
}) {
  return db
    .from("social_stick_replies")
    .insert({
      social_stick_id: data.stickId,
      user_id: data.userId,
      content: data.content,
      color: data.color,
      parent_reply_id: data.parentReplyId,
      category: data.category,
      org_id: data.orgId,
    })
    .select()
    .single()
}

async function fetchUserData(serviceDb: any, userId: string): Promise<User | null> {
  const { data, error } = await serviceDb
    .from("users")
    .select(USER_SELECT_FIELDS)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} Error fetching user data:`, error)
  }
  return data
}

// ============================================================================
// Access Control
// ============================================================================

async function checkReplyAccess(
  db: any,
  stick: StickWithPad,
  userId: string,
  orgId: string
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const isOwner = stick.social_pads?.[0]?.owner_id === userId
  if (isOwner) return { allowed: true }

  const { data: membership, error } = await fetchMembership(db, stick.social_pad_id, userId, orgId)

  if (error) {
    console.error(`${LOG_PREFIX} Error checking membership:`, error)
    return { allowed: false, response: Errors.verifyFailed() }
  }

  if (!membership) {
    return { allowed: false, response: Errors.accessDenied() }
  }

  if (membership.role === "viewer") {
    return { allowed: false, response: Errors.viewerNoReply() }
  }

  return { allowed: true }
}

async function validateStickAndAccess(
  db: any,
  stickId: string,
  userId: string,
  orgId: string
): Promise<{ success: true; stick: StickWithPad } | { success: false; response: NextResponse }> {
  const { data: stick, error: stickError } = await fetchStickWithPad(db, stickId, orgId)

  if (stickError || !stick) {
    if (stickError) console.error(`${LOG_PREFIX} Error fetching stick:`, stickError)
    return { success: false, response: Errors.stickNotFound() }
  }

  const accessResult = await checkReplyAccess(db, stick as StickWithPad, userId, orgId)
  if (!accessResult.allowed) {
    return { success: false, response: accessResult.response }
  }

  return { success: true, stick: stick as StickWithPad }
}

// ============================================================================
// Route Handlers
// ============================================================================

export async function GET(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const orgResult = await getOrgContextSafe()
    if ("error" in orgResult && orgResult.error === "RATE_LIMITED") {
      return Errors.rateLimit()
    }

    const orgId = "orgContext" in orgResult ? orgResult.orgContext.orgId : undefined

    const { data: replies, error } = await fetchRepliesForStick(db, stickId, orgId)

    if (error) {
      console.error(`${LOG_PREFIX} Error fetching replies:`, error)
      throw error
    }

    if (!replies || replies.length === 0) {
      return NextResponse.json({ replies: [] })
    }

    const userIds = [...new Set(replies.map((r: any) => r.user_id))] as string[]
    const serviceDb = await createServiceDatabaseClient()
    const userMap = await fetchUsersForReplies(serviceDb, userIds)

    const repliesWithUsers = replies.map((reply: any) => ({
      ...reply,
      users: userMap.get(reply.user_id) || null,
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching replies:`, error)
    return Errors.fetchFailed()
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    // Auth + org context check
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }
    const { user, orgContext } = authResult.context

    // Parse and validate input
    const { content, color, parent_reply_id, category }: ReplyInput = await request.json()
    if (!content?.trim()) {
      return Errors.contentRequired()
    }

    // Validate stick and check access
    const stickResult = await validateStickAndAccess(db, stickId, user.id, orgContext.orgId)
    if (!stickResult.success) {
      return stickResult.response
    }

    // Insert reply
    const { data: reply, error: insertError } = await insertReply(db, {
      stickId,
      userId: user.id,
      content: content.trim(),
      color: color || DEFAULT_REPLY_COLOR,
      parentReplyId: parent_reply_id || null,
      category: category || DEFAULT_CATEGORY,
      orgId: orgContext.orgId,
    })

    if (insertError) {
      console.error(`${LOG_PREFIX} Error inserting reply:`, insertError)
      return Errors.insertFailed(insertError.message)
    }

    if (!reply) {
      console.error(`${LOG_PREFIX} No reply returned after insert`)
      return Errors.createFailed()
    }

    // Fetch user data for response
    const serviceDb = await createServiceDatabaseClient()
    const userData = await fetchUserData(serviceDb, user.id)

    // Broadcast real-time events to org
    publishToOrg(orgContext.orgId, {
      type: "social_activity.new",
      payload: { stickId, replyId: reply.id, userId: user.id, activityType: "replied" },
      timestamp: Date.now(),
    })
    publishToOrg(orgContext.orgId, {
      type: "inference_notification.new",
      payload: { stickId, replyId: reply.id, userId: user.id, type: "stick_replied" },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      reply: { ...reply, users: userData },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating reply:`, error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to create reply", details: msg }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    // Auth + org context check
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }
    const { user, orgContext } = authResult.context

    // Parse and validate input
    const { reply_id, content } = await request.json()

    if (!reply_id || !content?.trim()) {
      return NextResponse.json({ error: "Reply ID and content are required" }, { status: 400 })
    }

    // Check reply exists and ownership
    const { data: existingReply } = await db
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

    // Update reply
    const { data: updatedReply, error } = await db
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
      console.error(`${LOG_PREFIX} Error updating reply:`, error)
      throw error
    }

    return NextResponse.json({ reply: updatedReply })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating reply:`, error)
    return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    // Auth + org context check
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }
    const { user, orgContext } = authResult.context
    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get("replyId")

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    // Check delete permission
    const canDeleteResult = await checkDeletePermission(db, stickId, replyId, user.id, orgContext.orgId)
    if (!canDeleteResult.allowed) {
      return canDeleteResult.response
    }

    // Delete reply
    const { error: deleteError } = await db
      .from("social_stick_replies")
      .delete()
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)

    if (deleteError) {
      console.error(`${LOG_PREFIX} Error deleting reply:`, deleteError)
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error deleting reply:`, error)
    return NextResponse.json({ error: "Failed to delete reply" }, { status: 500 })
  }
}

// ============================================================================
// Delete Permission Helper
// ============================================================================

async function checkDeletePermission(
  db: any,
  stickId: string,
  replyId: string,
  userId: string,
  orgId: string
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  // Fetch stick
  const { data: stick } = await fetchStickWithPad(db, stickId, orgId)
  if (!stick) {
    return { allowed: false, response: Errors.stickNotFound() }
  }

  const isPadOwner = (stick as StickWithPad).social_pads?.[0]?.owner_id === userId

  // Check membership
  const { data: membership } = await fetchMembership(db, stick.social_pad_id, userId, orgId)
  const isAdmin = membership?.role === "admin"

  // Check reply exists
  const { data: reply } = await db
    .from("social_stick_replies")
    .select("user_id")
    .eq("id", replyId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!reply) {
    return { allowed: false, response: NextResponse.json({ error: "Reply not found" }, { status: 404 }) }
  }

  const canDelete = reply.user_id === userId || isPadOwner || isAdmin
  if (!canDelete) {
    return { allowed: false, response: NextResponse.json({ error: "You don't have permission to delete this reply" }, { status: 403 }) }
  }

  return { allowed: true }
}

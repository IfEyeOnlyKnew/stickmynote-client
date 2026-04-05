import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// Types
interface AuthResult {
  user: { id: string; email?: string } | null
  rateLimited?: boolean
}

interface ReplyInput {
  content: string
  color?: string
  parent_reply_id?: string | null
  is_calstick?: boolean
  calstick_date?: string | null
  calstick_status?: string | null
  calstick_priority?: string | null
  calstick_parent_id?: string | null
  calstick_assignee_id?: string | null
}

interface UpdateReplyInput {
  replyId: string
  content: string
  color?: string
}

interface DeleteReplyInput {
  replyId: string
}

// Constants
const DEFAULT_REPLY_COLOR = "#fef3c7"

const REPLY_SELECT_FIELDS = `
  id,
  content,
  color,
  created_at,
  updated_at,
  user_id,
  parent_reply_id,
  is_calstick,
  calstick_date,
  calstick_completed,
  calstick_completed_at
`

// Helper to attach user data to replies
async function attachUsersToReplies(db: DatabaseClient, replies: any[]) {
  if (!replies.length) return replies

  const userIds = [...new Set(replies.map((r: any) => r.user_id).filter(Boolean))]
  if (userIds.length === 0) return replies.map(r => ({ ...r, user: null }))

  const { data: users } = await db
    .from("users")
    .select("id, username, email, full_name")
    .in("id", userIds)

  const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]))

  return replies.map((r: any) => ({
    ...r,
    user: userMap[r.user_id] || null,
  }))
}

// Helper functions
async function getAuthenticatedContext(): Promise<AuthResult & { response?: NextResponse }> {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === "rate_limited") {
    return { user: null, rateLimited: true, response: createRateLimitResponse() }
  }

  if (!user) {
    return { user: null, response: createUnauthorizedResponse() }
  }

  return { user }
}

async function fetchStick(
  db: DatabaseClient,
  stickId: string,
): Promise<{ padId: string; orgId: string } | null> {
  // Don't filter by org_id here - we verify access through pad membership instead
  const { data: stick, error } = await db
    .from("paks_pad_sticks")
    .select("pad_id, org_id")
    .eq("id", stickId)
    .maybeSingle()

  if (error || !stick) return null
  return { padId: stick.pad_id, orgId: stick.org_id }
}

async function checkPadAccess(
  db: DatabaseClient,
  padId: string,
  userId: string,
): Promise<{ isOwner: boolean; isMember: boolean }> {
  // Don't filter by org_id - verify access through ownership or membership
  const [padResult, memberResult] = await Promise.all([
    db
      .from("paks_pads")
      .select("owner_id")
      .eq("id", padId)
      .maybeSingle(),
    db
      .from("paks_pad_members")
      .select("role")
      .eq("pad_id", padId)
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  return {
    isOwner: padResult.data?.owner_id === userId,
    isMember: !!memberResult.data,
  }
}

function hasAccess(access: { isOwner: boolean; isMember: boolean }): boolean {
  return access.isOwner || access.isMember
}

async function fetchReply(
  db: DatabaseClient,
  replyId: string,
): Promise<{ userId: string; stickId?: string; orgId?: string } | null> {
  // Don't filter by org_id - we verify access through stick/pad ownership
  const { data: reply, error } = await db
    .from("paks_pad_stick_replies")
    .select("user_id, stick_id, org_id")
    .eq("id", replyId)
    .maybeSingle()

  if (error || !reply) return null
  return { userId: reply.user_id, stickId: reply.stick_id, orgId: reply.org_id }
}

async function deleteReply(db: DatabaseClient, replyId: string, orgId: string): Promise<void> {
  const { error } = await db
    .from("paks_pad_stick_replies")
    .delete()
    .eq("id", replyId)
    .eq("org_id", orgId)

  if (error) throw error
}

async function canDeleteReply(
  db: DatabaseClient,
  reply: { userId: string; stickId?: string },
  userId: string,
  stickId: string,
): Promise<boolean> {
  // User owns the reply
  if (reply.userId === userId) return true

  // Check if user is pad owner
  const stick = await fetchStick(db, stickId)
  if (!stick) return false

  const { data: pad } = await db
    .from("paks_pads")
    .select("owner_id")
    .eq("id", stick.padId)
    .maybeSingle()

  return pad?.owner_id === userId
}

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// Route handlers
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const auth = await getAuthenticatedContext()
    if (auth.response) return auth.response

    const { user } = auth
    const db = await createServiceDatabaseClient()

    // Fetch stick without org_id filter - we verify access through pad membership
    const stick = await fetchStick(db, stickId)
    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Verify access through pad ownership/membership
    const access = await checkPadAccess(db, stick.padId, user!.id)
    if (!hasAccess(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use the stick's actual org_id for querying replies
    const { data: replies, error } = await db
      .from("paks_pad_stick_replies")
      .select(REPLY_SELECT_FIELDS)
      .eq("stick_id", stickId)
      .eq("org_id", stick.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching stick replies:", error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    // Attach user data to replies
    const repliesWithUsers = await attachUsersToReplies(db, replies || [])

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("Error in stick replies GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const auth = await getAuthenticatedContext()
    if (auth.response) return auth.response

    const { user } = auth

    const body: ReplyInput = await request.json()
    const {
      content,
      color = DEFAULT_REPLY_COLOR,
      parent_reply_id = null,
      is_calstick = false,
      calstick_date = null,
      calstick_status = null,
      calstick_priority = null,
      calstick_parent_id = null,
      calstick_assignee_id = null,
    } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    // Fetch stick without org_id filter - we verify access through pad membership
    const stick = await fetchStick(db, stickId)
    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Verify access through pad ownership/membership
    const access = await checkPadAccess(db, stick.padId, user!.id)
    if (!hasAccess(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use the stick's actual org_id for the new reply
    const { data: reply, error } = await db
      .from("paks_pad_stick_replies")
      .insert({
        stick_id: stickId,
        user_id: user!.id,
        org_id: stick.orgId,
        content: content.trim(),
        color,
        parent_reply_id,
        is_calstick,
        calstick_date,
        calstick_status,
        calstick_priority,
        calstick_parent_id,
        calstick_assignee_id,
      })
      .select(REPLY_SELECT_FIELDS)
      .single()

    if (error) {
      console.error("Error creating stick reply:", error)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    // Attach user data to the reply
    const [replyWithUser] = await attachUsersToReplies(db, [reply])

    return NextResponse.json({ reply: replyWithUser })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("Error in stick replies POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params
    const auth = await getAuthenticatedContext()
    if (auth.response) return auth.response

    const { user } = auth

    const body: UpdateReplyInput = await request.json()
    const { replyId, content, color } = body

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    // Fetch reply without org_id filter
    const existingReply = await fetchReply(db, replyId)
    if (!existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    if (existingReply.userId !== user!.id) {
      return NextResponse.json({ error: "You can only edit your own replies" }, { status: 403 })
    }

    const updateData: Record<string, string> = {
      content: content.trim(),
      updated_at: new Date().toISOString(),
    }
    if (color !== undefined) {
      updateData.color = color
    }

    // Use the reply's actual org_id for the update
    const { data: reply, error } = await db
      .from("paks_pad_stick_replies")
      .update(updateData)
      .eq("id", replyId)
      .eq("org_id", existingReply.orgId)
      .select(REPLY_SELECT_FIELDS)
      .single()

    if (error) {
      console.error("Error updating stick reply:", error)
      return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
    }

    // Attach user data to the reply
    const [replyWithUser] = await attachUsersToReplies(db, [reply])

    return NextResponse.json({ reply: replyWithUser })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("Error in stick replies PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const auth = await getAuthenticatedContext()
    if (auth.response) return auth.response

    const { user } = auth

    const body: DeleteReplyInput = await request.json()
    const { replyId } = body

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    // Fetch reply without org_id filter
    const reply = await fetchReply(db, replyId)
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    const canDelete = await canDeleteReply(db, reply, user!.id, stickId)
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use the reply's actual org_id for deletion
    await deleteReply(db, replyId, reply.orgId!)
    return NextResponse.json({ success: true })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("Error in stick replies DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

// Types
interface OrgContext {
  orgId: string
}

interface AuthResult {
  user: { id: string; email?: string } | null
  orgContext: OrgContext | null
  rateLimited?: boolean
}

interface ReplyInput {
  content: string
  color?: string
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
async function safeGetOrgContext(userId: string): Promise<OrgContext | { rateLimited: true } | null> {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { rateLimited: true as const }
    }
    throw error
  }
}

async function getAuthenticatedContext(request?: NextRequest): Promise<AuthResult & { response?: NextResponse }> {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === "rate_limited") {
    return { user: null, orgContext: null, rateLimited: true, response: createRateLimitResponse() }
  }

  if (!user) {
    return { user: null, orgContext: null, response: createUnauthorizedResponse() }
  }

  const orgContextResult = await safeGetOrgContext(user.id)
  if (orgContextResult && "rateLimited" in orgContextResult) {
    return { user: null, orgContext: null, rateLimited: true, response: createRateLimitResponse() }
  }

  if (!orgContextResult) {
    return {
      user: null,
      orgContext: null,
      response: NextResponse.json({ error: "No organization context" }, { status: 403 }),
    }
  }

  return { user, orgContext: orgContextResult }
}

async function fetchStick(
  db: DatabaseClient,
  stickId: string,
  orgId: string,
): Promise<{ padId: string } | null> {
  const { data: stick, error } = await db
    .from("paks_pad_sticks")
    .select("pad_id")
    .eq("id", stickId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !stick) return null
  return { padId: stick.pad_id }
}

async function checkPadAccess(
  db: DatabaseClient,
  padId: string,
  userId: string,
  orgId: string,
): Promise<{ isOwner: boolean; isMember: boolean }> {
  const [padResult, memberResult] = await Promise.all([
    db
      .from("paks_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgId)
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
  orgId: string,
): Promise<{ userId: string; stickId?: string } | null> {
  const { data: reply, error } = await db
    .from("paks_pad_stick_replies")
    .select("user_id, stick_id")
    .eq("id", replyId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !reply) return null
  return { userId: reply.user_id, stickId: reply.stick_id }
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
  orgId: string,
): Promise<boolean> {
  // User owns the reply
  if (reply.userId === userId) return true

  // Check if user is pad owner
  const stick = await fetchStick(db, stickId, orgId)
  if (!stick) return false

  const { data: pad } = await db
    .from("paks_pads")
    .select("owner_id")
    .eq("id", stick.padId)
    .eq("org_id", orgId)
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

    const { user, orgContext } = auth
    const db = await createServiceDatabaseClient()

    const stick = await fetchStick(db, stickId, orgContext!.orgId)
    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const access = await checkPadAccess(db, stick.padId, user!.id, orgContext!.orgId)
    if (!hasAccess(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: replies, error } = await db
      .from("paks_pad_stick_replies")
      .select(REPLY_SELECT_FIELDS)
      .eq("stick_id", stickId)
      .eq("org_id", orgContext!.orgId)
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

    const { user, orgContext } = auth

    const body: ReplyInput = await request.json()
    const {
      content,
      color = DEFAULT_REPLY_COLOR,
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

    const stick = await fetchStick(db, stickId, orgContext!.orgId)
    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const access = await checkPadAccess(db, stick.padId, user!.id, orgContext!.orgId)
    if (!hasAccess(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: reply, error } = await db
      .from("paks_pad_stick_replies")
      .insert({
        stick_id: stickId,
        user_id: user!.id,
        org_id: orgContext!.orgId,
        content: content.trim(),
        color,
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
    const { id: stickId } = await params
    const auth = await getAuthenticatedContext()
    if (auth.response) return auth.response

    const { user, orgContext } = auth

    const body: UpdateReplyInput = await request.json()
    const { replyId, content, color } = body

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    const existingReply = await fetchReply(db, replyId, orgContext!.orgId)
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

    const { data: reply, error } = await db
      .from("paks_pad_stick_replies")
      .update(updateData)
      .eq("id", replyId)
      .eq("org_id", orgContext!.orgId)
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

    const { user, orgContext } = auth

    const body: DeleteReplyInput = await request.json()
    const { replyId } = body

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    const reply = await fetchReply(db, replyId, orgContext!.orgId)
    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    const canDelete = await canDeleteReply(db, reply, user!.id, stickId, orgContext!.orgId)
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await deleteReply(db, replyId, orgContext!.orgId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("Error in stick replies DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

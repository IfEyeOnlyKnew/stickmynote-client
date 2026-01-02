import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"

/**
 * AUTHORIZATION MODEL FOR PERSONAL STICK REPLIES:
 *
 * Personal Sticks (is_shared = false):
 * - Nobody but the Owner can access or view replies
 *
 * Shared Sticks (is_shared = true):
 * - Anyone can view replies (GET)
 * - Any authenticated user can create replies (POST)
 * - Users can edit their own replies (PUT)
 * - Users can delete their own replies OR stick owner can delete any reply (DELETE)
 */

// ============================================================================
// Types
// ============================================================================

interface AuthUser {
  id: string
  email?: string
}

interface OrgContext {
  orgId: string
  organizationId?: string
}

interface RateLimitedResult {
  rateLimited: true
}

interface Note {
  id?: string
  user_id: string
  org_id: string
  is_shared?: boolean
}

interface Reply {
  id: string
  content: string
  color: string
  created_at: string
  updated_at: string
  user_id: string
  view_count: number
  org_id: string
  personal_stick_id?: string
}

interface UserInfo {
  id: string
  username?: string
  full_name?: string
  avatar_url?: string
}

interface AuthenticatedContext {
  user: AuthUser
  orgContext: OrgContext
  db: DatabaseClient
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_REPLY_COLOR = "#fef3c7"

const REPLY_SELECT_FIELDS = `
  id,
  content,
  color,
  created_at,
  updated_at,
  user_id,
  view_count,
  org_id
`

const USER_SELECT_FIELDS = "id, username, full_name, avatar_url"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  accessDeniedPrivate: () => NextResponse.json({ error: "Access denied to private note" }, { status: 403 }),
  wrongOrganization: () => NextResponse.json({ error: "Access denied - wrong organization" }, { status: 403 }),
  noteNotFound: () => NextResponse.json({ error: "Note not found" }, { status: 404 }),
  replyNotFound: () => NextResponse.json({ error: "Reply not found" }, { status: 404 }),
  cannotReplyPrivate: () => NextResponse.json({ error: "Cannot reply to private note" }, { status: 403 }),
  cannotReplyDifferentOrg: () => NextResponse.json({ error: "Cannot reply to note from different organization" }, { status: 403 }),
  cannotReply: () => NextResponse.json({ error: "Cannot reply to this note" }, { status: 403 }),
  cannotEditOther: () => NextResponse.json({ error: "Cannot edit another user's reply" }, { status: 403 }),
  cannotDeleteOther: () => NextResponse.json({ error: "Cannot delete another user's reply" }, { status: 403 }),
  replyNotInOrg: () => NextResponse.json({ error: "Reply not in your organization" }, { status: 403 }),
  contentRequired: () => NextResponse.json({ error: "Content is required" }, { status: 400 }),
  replyIdRequired: () => NextResponse.json({ error: "Reply ID is required" }, { status: 400 }),
  createFailed: () => NextResponse.json({ error: "Failed to create reply" }, { status: 500 }),
  updateFailed: () => NextResponse.json({ error: "Failed to update reply" }, { status: 500 }),
  deleteFailed: () => NextResponse.json({ error: "Failed to delete reply" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Auth Helpers
// ============================================================================

function isRateLimited(result: OrgContext | RateLimitedResult | null): result is RateLimitedResult {
  return result !== null && "rateLimited" in result
}

async function safeGetOrgContext(userId: string): Promise<OrgContext | RateLimitedResult | null> {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { rateLimited: true }
    }
    throw error
  }
}

async function getAuthenticatedContext(): Promise<
  | { success: true; context: AuthenticatedContext }
  | { success: false; response: NextResponse }
> {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === "rate_limited") {
    return { success: false, response: createRateLimitResponse() }
  }

  if (!user) {
    return { success: false, response: createUnauthorizedResponse() }
  }

  const orgContextResult = await safeGetOrgContext(user.id)
  if (isRateLimited(orgContextResult)) {
    return { success: false, response: createRateLimitResponse() }
  }

  if (!orgContextResult) {
    return { success: false, response: Errors.noOrgContext() }
  }

  const db = await createServiceDatabaseClient()

  return {
    success: true,
    context: { user, orgContext: orgContextResult, db },
  }
}

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// ============================================================================
// Data Helpers
// ============================================================================

async function fetchNote(db: DatabaseClient, noteId: string): Promise<Note | null> {
  const { data } = await db
    .from("personal_sticks")
    .select("id, is_shared, user_id, org_id")
    .eq("id", noteId)
    .maybeSingle()

  return data
}

async function fetchReply(db: DatabaseClient, replyId: string): Promise<Reply | null> {
  const { data, error } = await db
    .from("personal_sticks_replies")
    .select("id, user_id, org_id, personal_stick_id")
    .eq("id", replyId)
    .maybeSingle()

  if (error || !data) return null
  return data as Reply
}

async function fetchUserMap(
  db: DatabaseClient,
  userIds: string[],
): Promise<Record<string, UserInfo>> {
  if (userIds.length === 0) return {}

  const { data: users } = await db
    .from("users")
    .select(USER_SELECT_FIELDS)
    .in("id", userIds)

  if (!users) return {}

  return Object.fromEntries(users.map((u: UserInfo) => [u.id, u]))
}

async function fetchUserInfo(db: DatabaseClient, userId: string): Promise<UserInfo | null> {
  try {
    const { data } = await db
      .from("users")
      .select(USER_SELECT_FIELDS)
      .eq("id", userId)
      .maybeSingle()
    return data
  } catch (e) {
    console.warn("[Replies] Failed to fetch user data:", e)
    return null
  }
}

function buildCompleteReply(reply: Reply, userData: UserInfo | null, fallbackEmail?: string): object {
  return {
    id: reply.id,
    content: reply.content,
    color: reply.color,
    created_at: reply.created_at,
    updated_at: reply.updated_at,
    user_id: reply.user_id,
    view_count: reply.view_count || 0,
    user: userData || {
      id: reply.user_id,
      username: fallbackEmail?.split("@")[0] || "User",
      full_name: null,
      avatar_url: null,
    },
  }
}

// ============================================================================
// Authorization Helpers
// ============================================================================

function checkReplyAuthorization(
  note: Note,
  userId: string,
  orgId: string
): { allowed: true } | { allowed: false; response: NextResponse } {
  // Shared notes allow anyone to reply
  if (note.is_shared) {
    return { allowed: true }
  }

  // Private notes: only owner can reply
  if (note.user_id !== userId) {
    return { allowed: false, response: Errors.cannotReplyPrivate() }
  }

  // Owner can always reply to their own private notes
  // This handles legacy notes without org_id and personal org fallback cases
  return { allowed: true }
}

function handleInsertError(error: any): NextResponse {
  if (error.code === "23503") {
    return Errors.noteNotFound()
  }
  if (error.code === "42501" || error.message?.includes("policy")) {
    return Errors.cannotReply()
  }
  console.error("[Replies] Insert error:", error)
  return Errors.createFailed()
}

// ============================================================================
// Handlers
// ============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: noteId } = await params
    const db = await createServiceDatabaseClient()

    const note = await fetchNote(db, noteId)
    if (!note) {
      return NextResponse.json({ replies: [] })
    }

    // Private note access check
    if (!note.is_shared) {
      const { user, error: authError } = await getCachedAuthUser()

      if (authError === "rate_limited") {
        return createRateLimitResponse()
      }

      if (!user || user.id !== note.user_id) {
        return Errors.accessDeniedPrivate()
      }

      const orgContextResult = await safeGetOrgContext(user.id)
      if (isRateLimited(orgContextResult)) {
        return createRateLimitResponse()
      }

      if (!orgContextResult || orgContextResult.orgId !== note.org_id) {
        return Errors.wrongOrganization()
      }
    }

    // Fetch replies
    const { data: replies, error } = await db
      .from("personal_sticks_replies")
      .select(REPLY_SELECT_FIELDS)
      .eq("personal_stick_id", noteId)
      .eq("org_id", note.org_id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[Replies] Error fetching replies:", error)
      return NextResponse.json({ replies: [] })
    }

    // Enrich with user data
    const userIds = [...new Set((replies || []).map((r: Reply) => r.user_id).filter(Boolean))] as string[]
    const usersMap = await fetchUserMap(db, userIds)

    const repliesWithUsers = (replies || []).map((reply: Reply) => ({
      ...reply,
      user: usersMap[reply.user_id] || null,
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Replies] GET error:", error)
    return Errors.internal()
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { id: noteId } = await params
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }

    const { user, orgContext, db } = authResult.context
    const body = await request.json()
    const { content, color = DEFAULT_REPLY_COLOR } = body

    if (!content?.trim()) {
      return Errors.contentRequired()
    }

    const note = await fetchNote(db, noteId)
    if (!note) {
      return Errors.noteNotFound()
    }

    // Check authorization
    const authCheck = checkReplyAuthorization(note, user.id, orgContext.orgId)
    if (!authCheck.allowed) {
      return authCheck.response
    }

    // Insert reply
    const { data: reply, error: insertError } = await db
      .from("personal_sticks_replies")
      .insert({
        personal_stick_id: noteId,
        user_id: user.id,
        content: content.trim(),
        color,
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (insertError) {
      return handleInsertError(insertError)
    }

    const userData = await fetchUserInfo(db, user.id)
    const completeReply = buildCompleteReply(reply, userData, user.email)

    return NextResponse.json({ reply: completeReply })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Replies] POST error:", error)
    return Errors.internal()
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: noteId } = await params
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }

    const { user, orgContext, db } = authResult.context
    const { replyId, content, color } = await request.json()

    console.log("[Replies PUT] noteId:", noteId, "replyId:", replyId, "orgId:", orgContext.orgId)

    if (!replyId) {
      return Errors.replyIdRequired()
    }

    const existingReply = await fetchReply(db, replyId)
    console.log("[Replies PUT] existingReply:", existingReply)
    if (!existingReply) {
      return Errors.replyNotFound()
    }

    if (existingReply.user_id !== user.id) {
      return Errors.cannotEditOther()
    }

    if (existingReply.org_id !== orgContext.orgId) {
      return Errors.replyNotInOrg()
    }

    // Build update data
    const updateData: Record<string, string> = { updated_at: new Date().toISOString() }
    if (content !== undefined) updateData.content = content.trim()
    if (color !== undefined) updateData.color = color

    const { data: reply, error } = await db
      .from("personal_sticks_replies")
      .update(updateData)
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      return Errors.updateFailed()
    }

    return NextResponse.json({ reply })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    return Errors.internal()
  }
}

export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }

    const { user, orgContext, db } = authResult.context
    const { replyId } = await request.json()

    if (!replyId) {
      return Errors.replyIdRequired()
    }

    const existingReply = await fetchReply(db, replyId)
    if (!existingReply) {
      return Errors.replyNotFound()
    }

    if (existingReply.org_id !== orgContext.orgId) {
      return Errors.replyNotInOrg()
    }

    // Check authorization: owner of reply OR owner of the note
    if (existingReply.user_id !== user.id) {
      const { data: note } = await db
        .from("personal_sticks")
        .select("user_id, org_id")
        .eq("id", existingReply.personal_stick_id)
        .maybeSingle()

      if (!note || note.user_id !== user.id || note.org_id !== orgContext.orgId) {
        return Errors.cannotDeleteOther()
      }
    }

    const { error } = await db
      .from("personal_sticks_replies")
      .delete()
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      return Errors.deleteFailed()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Replies] DELETE error:", error)
    return Errors.internal()
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { type DatabaseClient } from "@/lib/database/database-adapter"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { requireAuthOrgDb } from "@/lib/api/route-helpers"

/**
 * CHAT MESSAGES API
 *
 * Handles chat messages for threads that exceed MAX_REPLY_DEPTH.
 * Messages are linked to a parent reply ID which serves as the chat anchor.
 */

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string
  parent_reply_id: string
  org_id?: string
}

interface UserInfo {
  id: string
  email?: string
  full_name?: string
  avatar_url?: string
  username?: string
}

// ============================================================================
// Constants
// ============================================================================

const MESSAGE_SELECT_FIELDS = `
  id,
  content,
  created_at,
  updated_at,
  user_id,
  parent_reply_id,
  org_id
`

const USER_SELECT_FIELDS = "id, email, full_name, avatar_url"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  parentReplyNotFound: () => NextResponse.json({ error: "Parent reply not found" }, { status: 404 }),
  contentRequired: () => NextResponse.json({ error: "Content is required" }, { status: 400 }),
  createFailed: () => NextResponse.json({ error: "Failed to create message" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Auth Helpers
// ============================================================================

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// ============================================================================
// Data Helpers
// ============================================================================

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
    console.warn("[Chat] Failed to fetch user data:", e)
    return null
  }
}

async function verifyParentReplyExists(db: DatabaseClient, parentReplyId: string): Promise<boolean> {
  const { data } = await db
    .from("personal_sticks_replies")
    .select("id")
    .eq("id", parentReplyId)
    .maybeSingle()

  return !!data
}

function buildCompleteMessage(message: ChatMessage, userData: UserInfo | null, fallbackEmail?: string): object {
  return {
    id: message.id,
    content: message.content,
    created_at: message.created_at,
    updated_at: message.updated_at,
    user_id: message.user_id,
    parent_reply_id: message.parent_reply_id,
    user: {
      id: userData?.id || message.user_id,
      username: userData?.full_name || fallbackEmail?.split("@")[0] || "User",
      email: userData?.email || fallbackEmail || null,
      full_name: userData?.full_name || null,
      avatar_url: userData?.avatar_url || null,
    },
  }
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/chat/[parentReplyId]/messages
 * Fetch all messages for a chat thread
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parentReplyId: string }> }
) {
  try {
    const { parentReplyId } = await params
    const ctx = await requireAuthOrgDb()
    if ("response" in ctx) return ctx.response
    const { db } = ctx

    // Verify parent reply exists
    const parentExists = await verifyParentReplyExists(db, parentReplyId)
    if (!parentExists) {
      return Errors.parentReplyNotFound()
    }

    // Fetch messages ordered by creation time (oldest first for chat flow)
    const { data: messages, error } = await db
      .from("chat_messages")
      .select(MESSAGE_SELECT_FIELDS)
      .eq("parent_reply_id", parentReplyId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[Chat] Error fetching messages:", error)
      return NextResponse.json({ messages: [] })
    }

    // Enrich with user data
    const userIds = [...new Set((messages || []).map((m: ChatMessage) => m.user_id).filter(Boolean))] as string[]
    const usersMap = await fetchUserMap(db, userIds)

    const messagesWithUsers = (messages || []).map((message: ChatMessage) => ({
      ...message,
      user: usersMap[message.user_id] || null,
    }))

    return NextResponse.json({ messages: messagesWithUsers })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Chat] GET error:", error)
    return Errors.internal()
  }
}

/**
 * POST /api/chat/[parentReplyId]/messages
 * Create a new message in a chat thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parentReplyId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { parentReplyId } = await params
    const ctx = await requireAuthOrgDb()
    if ("response" in ctx) return ctx.response
    const { user, orgContext, db } = ctx
    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return Errors.contentRequired()
    }

    // Verify parent reply exists
    const parentExists = await verifyParentReplyExists(db, parentReplyId)
    if (!parentExists) {
      return Errors.parentReplyNotFound()
    }

    // Insert message
    const { data: message, error: insertError } = await db
      .from("chat_messages")
      .insert({
        parent_reply_id: parentReplyId,
        user_id: user.id,
        content: content.trim(),
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[Chat] Insert error:", insertError)
      return Errors.createFailed()
    }

    const userData = await fetchUserInfo(db, user.id)
    const completeMessage = buildCompleteMessage(message, userData, user.email)

    return NextResponse.json({ message: completeMessage })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Chat] POST error:", error)
    return Errors.internal()
  }
}

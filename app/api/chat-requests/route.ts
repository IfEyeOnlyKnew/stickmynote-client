import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { publishToUser } from "@/lib/ws/publish-event"
import type { ChatRequest, ChatRequestStatus } from "@/types/chat-request"

/**
 * CHAT REQUESTS API
 *
 * Handles chat invitation requests between users.
 * GET - Fetch pending requests for current user (as recipient or requester)
 * POST - Create a new chat request
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

const REQUEST_SELECT_FIELDS = `
  id,
  parent_reply_id,
  requester_id,
  recipient_id,
  org_id,
  status,
  response_message,
  wait_until,
  created_at,
  updated_at
`

const USER_SELECT_FIELDS = "id, email, full_name, avatar_url, username"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  parentReplyRequired: () => NextResponse.json({ error: "parent_reply_id is required" }, { status: 400 }),
  recipientRequired: () => NextResponse.json({ error: "recipient_id is required" }, { status: 400 }),
  parentReplyNotFound: () => NextResponse.json({ error: "Parent reply not found" }, { status: 404 }),
  cannotRequestSelf: () => NextResponse.json({ error: "Cannot send chat request to yourself" }, { status: 400 }),
  pendingExists: () => NextResponse.json({ error: "A pending chat request already exists for this thread" }, { status: 409 }),
  createFailed: () => NextResponse.json({ error: "Failed to create chat request" }, { status: 500 }),
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

async function getAuthenticatedContext(request: NextRequest) {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === "rate_limited") {
    return { error: createRateLimitResponse() }
  }

  if (!user) {
    return { error: createUnauthorizedResponse() }
  }

  const orgContextResult = await safeGetOrgContext(user.id)

  if (isRateLimited(orgContextResult)) {
    return { error: createRateLimitResponse() }
  }

  if (!orgContextResult) {
    return { error: Errors.noOrgContext() }
  }

  const db = await createServiceDatabaseClient()

  return { user, orgContext: orgContextResult, db }
}

// ============================================================================
// Helpers
// ============================================================================

async function enrichRequestWithUsers(
  db: DatabaseClient,
  request: any
): Promise<ChatRequest> {
  // Fetch requester info
  const { data: requester } = await db
    .from("users")
    .select(USER_SELECT_FIELDS)
    .eq("id", request.requester_id)
    .maybeSingle()

  // Fetch recipient info
  const { data: recipient } = await db
    .from("users")
    .select(USER_SELECT_FIELDS)
    .eq("id", request.recipient_id)
    .maybeSingle()

  // Fetch parent reply info
  const { data: parentReply } = await db
    .from("personal_sticks_replies")
    .select("id, content, user_id")
    .eq("id", request.parent_reply_id)
    .maybeSingle()

  let parentReplyUser = null
  if (parentReply?.user_id) {
    const { data: replyUser } = await db
      .from("users")
      .select(USER_SELECT_FIELDS)
      .eq("id", parentReply.user_id)
      .maybeSingle()
    parentReplyUser = replyUser
  }

  return {
    ...request,
    requester: requester || undefined,
    recipient: recipient || undefined,
    parent_reply: parentReply ? {
      id: parentReply.id,
      content: parentReply.content,
      user: parentReplyUser || undefined,
    } : undefined,
  }
}

// ============================================================================
// GET - Fetch chat requests for current user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext(request)
    if ("error" in ctx) return ctx.error

    const { user, db } = ctx

    const url = new URL(request.url)
    const role = url.searchParams.get("role") || "recipient" // recipient or requester
    const status = url.searchParams.get("status") // optional status filter

    // Build query
    let query = db
      .from("chat_requests")
      .select(REQUEST_SELECT_FIELDS)

    if (role === "requester") {
      query = query.eq("requester_id", user.id)
    } else {
      query = query.eq("recipient_id", user.id)
    }

    if (status) {
      query = query.eq("status", status)
    } else if (role === "recipient") {
      // For recipients, default to pending requests only
      query = query.eq("status", "pending")
    }

    query = query.order("created_at", { ascending: false })

    const { data: requests, error } = await query

    if (error) {
      console.error("[ChatRequests GET] Query error:", error)
      return Errors.internal()
    }

    // Enrich with user data
    const enrichedRequests = await Promise.all(
      (requests || []).map((req) => enrichRequestWithUsers(db, req))
    )

    return NextResponse.json({
      requests: enrichedRequests,
      total: enrichedRequests.length,
    })
  } catch (error) {
    console.error("[ChatRequests GET] Error:", error)
    return Errors.internal()
  }
}

// ============================================================================
// POST - Create a new chat request
// ============================================================================

export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const ctx = await getAuthenticatedContext(request)
    if ("error" in ctx) return ctx.error

    const { user, orgContext, db } = ctx

    const body = await request.json()
    const { parent_reply_id, recipient_id } = body

    if (!parent_reply_id) {
      return Errors.parentReplyRequired()
    }

    // Verify parent reply exists and get the reply user
    const { data: parentReply } = await db
      .from("personal_sticks_replies")
      .select("id, user_id, content")
      .eq("id", parent_reply_id)
      .maybeSingle()

    if (!parentReply) {
      return Errors.parentReplyNotFound()
    }

    // Determine recipient - use provided or default to reply author
    const finalRecipientId = recipient_id || parentReply.user_id

    if (!finalRecipientId) {
      return Errors.recipientRequired()
    }

    // Cannot request chat with yourself
    if (finalRecipientId === user.id) {
      return Errors.cannotRequestSelf()
    }

    // Check for existing pending request
    const { data: existingRequest } = await db
      .from("chat_requests")
      .select("id")
      .eq("parent_reply_id", parent_reply_id)
      .eq("requester_id", user.id)
      .eq("recipient_id", finalRecipientId)
      .eq("status", "pending")
      .maybeSingle()

    if (existingRequest) {
      return Errors.pendingExists()
    }

    // Create the chat request
    const { data: newRequest, error: insertError } = await db
      .from("chat_requests")
      .insert({
        parent_reply_id,
        requester_id: user.id,
        recipient_id: finalRecipientId,
        org_id: orgContext.orgId,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(REQUEST_SELECT_FIELDS)
      .single()

    if (insertError || !newRequest) {
      console.error("[ChatRequests POST] Insert error:", insertError)
      return Errors.createFailed()
    }

    // Enrich with user data
    const enrichedRequest = await enrichRequestWithUsers(db, newRequest)

    // Push real-time event to recipient
    publishToUser(finalRecipientId, {
      type: "chat_request.new",
      payload: enrichedRequest,
      timestamp: Date.now(),
    })

    return NextResponse.json({ request: enrichedRequest }, { status: 201 })
  } catch (error) {
    console.error("[ChatRequests POST] Error:", error)
    return Errors.internal()
  }
}

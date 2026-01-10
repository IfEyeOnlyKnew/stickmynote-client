import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import type { ChatRequest, ChatRequestStatus } from "@/types/chat-request"

/**
 * CHAT REQUEST API - Single Request Operations
 *
 * GET - Get single chat request details
 * PATCH - Update request status (respond to invitation)
 * DELETE - Cancel/withdraw a chat request (requester only)
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

const VALID_STATUSES: ChatRequestStatus[] = [
  "pending",
  "accepted",
  "busy",
  "schedule_meeting",
  "give_me_5_minutes",
  "cancelled",
]

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  notFound: () => NextResponse.json({ error: "Chat request not found" }, { status: 404 }),
  notAuthorized: () => NextResponse.json({ error: "Not authorized to access this request" }, { status: 403 }),
  invalidStatus: () => NextResponse.json({ error: "Invalid status value" }, { status: 400 }),
  cannotUpdateStatus: () => NextResponse.json({ error: "Cannot update request with current status" }, { status: 400 }),
  onlyRequesterCanCancel: () => NextResponse.json({ error: "Only the requester can cancel a chat request" }, { status: 403 }),
  updateFailed: () => NextResponse.json({ error: "Failed to update chat request" }, { status: 500 }),
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
// GET - Get single chat request
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext(request)
    if ("error" in ctx) return ctx.error

    const { user, db } = ctx
    const { requestId } = await params

    const { data: chatRequest, error } = await db
      .from("chat_requests")
      .select(REQUEST_SELECT_FIELDS)
      .eq("id", requestId)
      .maybeSingle()

    if (error || !chatRequest) {
      return Errors.notFound()
    }

    // Must be requester or recipient to view
    if (chatRequest.requester_id !== user.id && chatRequest.recipient_id !== user.id) {
      return Errors.notAuthorized()
    }

    const enrichedRequest = await enrichRequestWithUsers(db, chatRequest)

    return NextResponse.json({ request: enrichedRequest })
  } catch (error) {
    console.error("[ChatRequest GET] Error:", error)
    return Errors.internal()
  }
}

// ============================================================================
// PATCH - Update request status (respond to invitation)
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const ctx = await getAuthenticatedContext(request)
    if ("error" in ctx) return ctx.error

    const { user, db } = ctx
    const { requestId } = await params

    const body = await request.json()
    const { status, response_message } = body

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return Errors.invalidStatus()
    }

    // Get existing request
    const { data: existingRequest, error: fetchError } = await db
      .from("chat_requests")
      .select(REQUEST_SELECT_FIELDS)
      .eq("id", requestId)
      .maybeSingle()

    if (fetchError || !existingRequest) {
      return Errors.notFound()
    }

    // Authorization check
    // - Recipient can change status to: accepted, busy, schedule_meeting, give_me_5_minutes
    // - Requester can only cancel (handled by DELETE)
    if (existingRequest.recipient_id !== user.id) {
      return Errors.notAuthorized()
    }

    // Can only respond to pending requests
    if (existingRequest.status !== "pending") {
      return Errors.cannotUpdateStatus()
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (response_message) {
      updatePayload.response_message = response_message
    }

    // Set wait_until for "give_me_5_minutes" status
    if (status === "give_me_5_minutes") {
      const waitUntil = new Date()
      waitUntil.setMinutes(waitUntil.getMinutes() + 5)
      updatePayload.wait_until = waitUntil.toISOString()
    }

    // Update the request
    const { data: updatedRequest, error: updateError } = await db
      .from("chat_requests")
      .update(updatePayload)
      .eq("id", requestId)
      .select(REQUEST_SELECT_FIELDS)
      .single()

    if (updateError || !updatedRequest) {
      console.error("[ChatRequest PATCH] Update error:", updateError)
      return Errors.updateFailed()
    }

    const enrichedRequest = await enrichRequestWithUsers(db, updatedRequest)

    return NextResponse.json({ request: enrichedRequest })
  } catch (error) {
    console.error("[ChatRequest PATCH] Error:", error)
    return Errors.internal()
  }
}

// ============================================================================
// DELETE - Cancel/withdraw a chat request (requester only)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const ctx = await getAuthenticatedContext(request)
    if ("error" in ctx) return ctx.error

    const { user, db } = ctx
    const { requestId } = await params

    // Get existing request
    const { data: existingRequest, error: fetchError } = await db
      .from("chat_requests")
      .select("id, requester_id, status")
      .eq("id", requestId)
      .maybeSingle()

    if (fetchError || !existingRequest) {
      return Errors.notFound()
    }

    // Only requester can cancel
    if (existingRequest.requester_id !== user.id) {
      return Errors.onlyRequesterCanCancel()
    }

    // Can only cancel pending requests
    if (existingRequest.status !== "pending") {
      return Errors.cannotUpdateStatus()
    }

    // Update to cancelled status (soft delete to keep record)
    const { error: updateError } = await db
      .from("chat_requests")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)

    if (updateError) {
      console.error("[ChatRequest DELETE] Update error:", updateError)
      return Errors.updateFailed()
    }

    return NextResponse.json({ success: true, message: "Chat request cancelled" })
  } catch (error) {
    console.error("[ChatRequest DELETE] Error:", error)
    return Errors.internal()
  }
}

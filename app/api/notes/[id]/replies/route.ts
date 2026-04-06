import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { publishToUser } from "@/lib/ws/publish-event"
import {
  getRepliesForNote,
  createReplyOnNote,
  updateReplyOnNote,
  deleteReplyOnNote,
} from "@/lib/handlers/notes-replies-handler"

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
// Auth Helpers
// ============================================================================

interface OrgContext {
  orgId: string
  organizationId?: string
}

interface RateLimitedResult {
  rateLimited: true
}

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
  | { success: true; user: { id: string; email?: string }; orgId: string }
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
    return { success: false, response: NextResponse.json({ error: "No organization context" }, { status: 403 }) }
  }

  return { success: true, user, orgId: orgContextResult.orgId }
}

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// ============================================================================
// Handlers
// ============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: noteId } = await params

    // For private note checks, we need the user ID (if authenticated)
    let userId: string | undefined
    try {
      const { user, error: authError } = await getCachedAuthUser()
      if (authError === "rate_limited") return createRateLimitResponse()
      userId = user?.id
    } catch {
      // Not authenticated — only shared notes will be accessible
    }

    const { status, body } = await getRepliesForNote(noteId, userId)
    return NextResponse.json(body, { status })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Replies] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  try {
    const { id: noteId } = await params
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const { content, color, parent_reply_id } = body

    console.log("[Replies POST] Request body:", body)
    console.log("[Replies POST] Parsed parent_reply_id:", parent_reply_id)

    const result = await createReplyOnNote(noteId, {
      user: authResult.user,
      orgId: authResult.orgId,
    }, { content, color, parent_reply_id })

    // Push notification + activity event to the note owner (if someone else replied)
    if (result.noteOwnerId) {
      publishToUser(result.noteOwnerId, {
        type: "notification.new",
        payload: { noteId, replyId: result.replyId, userId: authResult.user.id, actionType: "replied" },
        timestamp: Date.now(),
      })
      publishToUser(result.noteOwnerId, {
        type: "activity.new",
        payload: { noteId, replyId: result.replyId, userId: authResult.user.id, actionType: "replied" },
        timestamp: Date.now(),
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Replies] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: noteId } = await params
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) return authResult.response

    const { replyId, content, color } = await request.json()

    console.log("[Replies PUT] noteId:", noteId, "replyId:", replyId, "orgId:", authResult.orgId)

    const result = await updateReplyOnNote(
      { user: authResult.user, orgId: authResult.orgId },
      { replyId, content, color }
    )

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  try {
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) return authResult.response

    const { replyId } = await request.json()

    const result = await deleteReplyOnNote(
      { user: authResult.user, orgId: authResult.orgId },
      replyId
    )

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[Replies] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

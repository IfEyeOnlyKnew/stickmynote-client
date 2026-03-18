import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getUserChats,
  createChat,
  addChatMember,
  findChatForStick,
  findChatByName,
} from "@/lib/database/stick-chat-queries"
import type { CreateStickChatRequest, StickChatFilters } from "@/types/stick-chat"

/**
 * STICK CHATS API
 *
 * Handles listing and creating stick chats.
 * Supports both standalone chats and per-stick chats.
 */

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  createFailed: () => NextResponse.json({ error: "Failed to create chat" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

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

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/stick-chats
 * List all chats for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (isRateLimited(orgContextResult)) {
      return createRateLimitResponse()
    }

    // Parse query params for filters
    const { searchParams } = new URL(request.url)
    const filters: StickChatFilters = {}

    if (searchParams.has("stick_id")) {
      filters.stick_id = searchParams.get("stick_id")!
    }
    if (searchParams.has("stick_type")) {
      const stickType = searchParams.get("stick_type")
      if (stickType === "personal" || stickType === "social" || stickType === "pad") {
        filters.stick_type = stickType
      }
    }
    if (searchParams.has("is_group")) {
      filters.is_group = searchParams.get("is_group") === "true"
    }
    if (searchParams.has("include_expired")) {
      filters.include_expired = searchParams.get("include_expired") === "true"
    }

    const chats = await getUserChats(user.id, orgContextResult?.orgId || null, filters)

    return NextResponse.json({ chats, total: chats.length })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChats] GET error:", error)
    return Errors.internal()
  }
}

/**
 * POST /api/stick-chats
 * Create a new chat (standalone or attached to a stick)
 */
export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (isRateLimited(orgContextResult)) {
      return createRateLimitResponse()
    }

    const body: CreateStickChatRequest = await request.json()
    const { name, stick_id, stick_type, is_group, member_ids } = body

    // If this is a per-stick chat, check if one already exists
    if (stick_id && stick_type) {
      const existingChat = await findChatForStick(stick_id, stick_type, user.id)
      if (existingChat) {
        return NextResponse.json({ chat: existingChat, existing: true })
      }
    }

    // Check if a chat with this name already exists for the user
    if (name && name.trim()) {
      const existingChatByName = await findChatByName(name.trim(), user.id, orgContextResult?.orgId || null)
      if (existingChatByName) {
        return NextResponse.json({ chat: existingChatByName, existing: true })
      }
    }

    // Create the chat
    const chat = await createChat({
      name,
      stick_id,
      stick_type,
      owner_id: user.id,
      org_id: orgContextResult?.orgId,
      is_group,
    })

    if (!chat) {
      return Errors.createFailed()
    }

    // Add initial members if provided
    if (member_ids && member_ids.length > 0) {
      for (const memberId of member_ids) {
        if (memberId !== user.id) {
          await addChatMember(chat.id, memberId)
        }
      }
    }

    return NextResponse.json({ chat, existing: false }, { status: 201 })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChats] POST error:", error)
    return Errors.internal()
  }
}

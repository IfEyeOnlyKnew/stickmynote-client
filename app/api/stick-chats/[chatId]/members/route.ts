import { type NextRequest, NextResponse } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { db } from "@/lib/database/pg-client"
import {
  getChatById,
  getChatMembers,
  addChatMember,
  removeChatMember,
} from "@/lib/database/stick-chat-queries"
import { authenticateWithOrg, handleRateLimitError } from "@/lib/handlers/stick-chats-handler"
import type { AddMemberRequest } from "@/types/stick-chat"

/**
 * STICK CHAT MEMBERS API
 *
 * Handles listing, adding, and removing chat members.
 */

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  notFound: () => NextResponse.json({ error: "Chat not found" }, { status: 404 }),
  forbidden: () => NextResponse.json({ error: "Only the chat owner can manage members" }, { status: 403 }),
  userIdRequired: () => NextResponse.json({ error: "user_id or email is required" }, { status: 400 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/stick-chats/[chatId]/members
 * Get all members of a chat
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const auth = await authenticateWithOrg()
    if (!auth.ok) return auth.response

    // Verify chat exists and user has access
    const chat = await getChatById(chatId, auth.user.id)
    if (!chat) {
      return Errors.notFound()
    }

    const members = await getChatMembers(chatId)

    return NextResponse.json({ members })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChatMembers] GET error:", error)
    return Errors.internal()
  }
}

/**
 * POST /api/stick-chats/[chatId]/members
 * Add a member to a chat (owner only)
 * Supports:
 *   - { user_id: string } for existing database users
 *   - { email, dn?, full_name?, username? } for LDAP users to auto-provision
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { chatId } = await params
    const auth = await authenticateWithOrg()
    if (!auth.ok) return auth.response

    // Verify chat exists and user is owner
    const chat = await getChatById(chatId, auth.user.id)
    if (!chat) {
      return Errors.notFound()
    }

    if (chat.owner_id !== auth.user.id) {
      return Errors.forbidden()
    }

    const body: AddMemberRequest = await request.json()
    let { user_id } = body
    const { email, dn, full_name, username } = body

    // If no user_id but we have email, try to find or create the user
    if (!user_id && email) {
      // First, check if user already exists by email or DN
      const existingUserResult = await db.query(
        `SELECT id FROM users WHERE email = $1 ${dn ? 'OR distinguished_name = $2' : ''} LIMIT 1`,
        dn ? [email, dn] : [email]
      )

      if (existingUserResult.rows.length > 0) {
        user_id = existingUserResult.rows[0].id
      } else {
        // Auto-provision the LDAP user
        const newUserResult = await db.query(
          `INSERT INTO users (email, full_name, username, distinguished_name, email_verified, hub_mode, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, 'full_access', NOW(), NOW())
           RETURNING id`,
          [email, full_name || username || email.split('@')[0], username, dn || null]
        )
        user_id = newUserResult.rows[0].id
        console.log(`[StickChatMembers] Auto-provisioned LDAP user: ${email} (${user_id})`)
      }
    }

    if (!user_id) {
      return Errors.userIdRequired()
    }

    const member = await addChatMember(chatId, user_id)
    if (!member) {
      // Member may already exist (ON CONFLICT DO NOTHING)
      const members = await getChatMembers(chatId)
      return NextResponse.json({ members })
    }

    const members = await getChatMembers(chatId)
    return NextResponse.json({ members }, { status: 201 })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChatMembers] POST error:", error)
    return Errors.internal()
  }
}

/**
 * DELETE /api/stick-chats/[chatId]/members
 * Remove a member from a chat
 * Body: { user_id: string }
 * Owner can remove anyone, members can remove themselves
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { chatId } = await params
    const auth = await authenticateWithOrg()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return Errors.userIdRequired()
    }

    const removed = await removeChatMember(chatId, user_id, auth.user.id)
    if (removed === 0) {
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    const members = await getChatMembers(chatId)
    return NextResponse.json({ members, success: true })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChatMembers] DELETE error:", error)
    return Errors.internal()
  }
}

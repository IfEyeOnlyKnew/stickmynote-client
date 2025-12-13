import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
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

async function safeGetOrgContext(userId: string) {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { rateLimited: true as const }
    }
    throw error
  }
}

// GET: Fetch replies for a personal stick
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: noteId } = params
    const adminClient = createServiceClient()

    const { data: note, error: noteError } = await adminClient
      .from("personal_sticks")
      .select("id, is_shared, user_id, org_id")
      .eq("id", noteId)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json({ replies: [] })
    }

    if (!note.is_shared) {
      const { user, error: authError } = await getCachedAuthUser()

      if (authError === "rate_limited") {
        return createRateLimitResponse()
      }

      if (!user || user.id !== note.user_id) {
        return NextResponse.json({ error: "Access denied to private note" }, { status: 403 })
      }

      const orgContextResult = await safeGetOrgContext(user.id)
      if (orgContextResult && "rateLimited" in orgContextResult) {
        return createRateLimitResponse()
      }
      if (!orgContextResult || orgContextResult.orgId !== note.org_id) {
        return NextResponse.json({ error: "Access denied - wrong organization" }, { status: 403 })
      }
    }

    const { data: replies, error } = await adminClient
      .from("personal_sticks_replies")
      .select(`
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        view_count,
        org_id
      `)
      .eq("personal_stick_id", noteId)
      .eq("org_id", note.org_id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching replies:", error)
      return NextResponse.json({ replies: [] })
    }

    const userIds = [...new Set((replies || []).map((r) => r.user_id).filter(Boolean))]
    let usersMap: Record<string, { username?: string; full_name?: string; avatar_url?: string }> = {}

    if (userIds.length > 0) {
      const { data: users } = await adminClient
        .from("users")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds)

      if (users) {
        usersMap = Object.fromEntries(users.map((u) => [u.id, u]))
      }
    }

    const repliesWithUsers = (replies || []).map((reply) => ({
      ...reply,
      user: usersMap[reply.user_id] || null,
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("GET replies error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a reply on a shared personal stick
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse("Unauthorized - please log in to reply")
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const { id: noteId } = params
    const body = await request.json()
    const { content, color = "#fef3c7" } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const adminClient = createServiceClient()

    const { data: note } = await adminClient
      .from("personal_sticks")
      .select("org_id, is_shared, user_id")
      .eq("id", noteId)
      .maybeSingle()

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    // For private notes: only the owner can reply
    // For shared notes: anyone in the same organization can reply
    if (!note.is_shared) {
      // Private note - only owner can reply
      if (note.user_id !== user.id) {
        return NextResponse.json({ error: "Cannot reply to private note" }, { status: 403 })
      }
    } else {
      // Shared note - user must be in the same organization as the note
      if (note.org_id !== orgContext.orgId) {
        return NextResponse.json({ error: "Cannot reply to note from different organization" }, { status: 403 })
      }
    }

    const replyData = {
      personal_stick_id: noteId,
      user_id: user.id,
      content: content.trim(),
      color,
      org_id: note.org_id, // Use the note's org_id, not the user's orgContext
    }

    const { data: reply, error: insertError } = await adminClient
      .from("personal_sticks_replies")
      .insert(replyData)
      .select()
      .single()

    if (insertError) {
      if (insertError.code === "23503") {
        return NextResponse.json({ error: "Note not found" }, { status: 404 })
      }
      if (insertError.code === "42501" || insertError.message?.includes("policy")) {
        return NextResponse.json({ error: "Cannot reply to this note" }, { status: 403 })
      }
      console.error("Reply insert error:", insertError)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    let userData = null
    try {
      const { data: userDataResult } = await adminClient
        .from("users")
        .select("id, username, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
      userData = userDataResult
    } catch (e) {}

    const completeReply = {
      id: reply.id,
      content: reply.content,
      color: reply.color,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      user_id: reply.user_id,
      view_count: reply.view_count || 0,
      user: userData || {
        id: user.id,
        username: user.email?.split("@")[0] || "User",
        full_name: null,
        avatar_url: null,
      },
    }

    return NextResponse.json({ reply: completeReply })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("POST replies error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT: Edit a reply
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContextResult = await safeGetOrgContext(user.id)
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const { replyId, content, color } = await request.json()

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    const adminClient = createServiceClient()

    const { data: existingReply, error: replyError } = await adminClient
      .from("personal_sticks_replies")
      .select("user_id, org_id")
      .eq("id", replyId)
      .maybeSingle()

    if (replyError || !existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    if (existingReply.user_id !== user.id) {
      return NextResponse.json({ error: "Cannot edit another user's reply" }, { status: 403 })
    }

    if (existingReply.org_id !== orgContext.orgId) {
      return NextResponse.json({ error: "Reply not in your organization" }, { status: 403 })
    }

    const updateData: Record<string, string> = { updated_at: new Date().toISOString() }
    if (content !== undefined) updateData.content = content.trim()
    if (color !== undefined) updateData.color = color

    const { data: reply, error } = await adminClient
      .from("personal_sticks_replies")
      .update(updateData)
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update reply" }, { status: 500 })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a reply
export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
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
    if (orgContextResult && "rateLimited" in orgContextResult) {
      return createRateLimitResponse()
    }
    if (!orgContextResult) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }
    const orgContext = orgContextResult

    const { replyId } = await request.json()

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    const adminClient = createServiceClient()

    const { data: existingReply, error: replyError } = await adminClient
      .from("personal_sticks_replies")
      .select("user_id, personal_stick_id, org_id")
      .eq("id", replyId)
      .maybeSingle()

    if (replyError || !existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    if (existingReply.org_id !== orgContext.orgId) {
      return NextResponse.json({ error: "Reply not in your organization" }, { status: 403 })
    }

    if (existingReply.user_id !== user.id) {
      const { data: note } = await adminClient
        .from("personal_sticks")
        .select("user_id, org_id")
        .eq("id", existingReply.personal_stick_id)
        .maybeSingle()

      if (!note || note.user_id !== user.id || note.org_id !== orgContext.orgId) {
        return NextResponse.json({ error: "Cannot delete another user's reply" }, { status: 403 })
      }
    }

    const { error } = await adminClient
      .from("personal_sticks_replies")
      .delete()
      .eq("id", replyId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete reply" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("DELETE replies error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

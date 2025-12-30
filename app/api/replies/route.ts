import type { NextRequest } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { replyValidation, validateAndSanitize, validateUUID } from "@/lib/input-validation-enhanced"
import { NextResponse } from "next/server"
import { sanitizeRequestBody } from "@/lib/html-sanitizer"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get("note_id")

    if (!noteId || !validateUUID(noteId)) {
      return NextResponse.json({ error: "Valid note ID is required" }, { status: 400 })
    }

    const { data: note, error: noteError } = await db
      .from("personal_sticks")
      .select("user_id, is_shared, org_id")
      .eq("id", noteId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    if (note.user_id !== user.id && !note.is_shared) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: replies, error } = await db
      .from("personal_sticks_replies")
      .select("*")
      .eq("personal_stick_id", noteId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching replies:", error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    // Fetch user data separately
    const userIds = [...new Set((replies || []).map((r: any) => r.user_id).filter(Boolean))]
    let userMap: Record<string, { username?: string; email?: string }> = {}
    if (userIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, username, email")
        .in("id", userIds)
      if (users) {
        userMap = Object.fromEntries(users.map((u: any) => [u.id, { username: u.username, email: u.email }]))
      }
    }
    const repliesWithUsers = (replies || []).map((reply: any) => ({
      ...reply,
      user: userMap[reply.user_id] || null,
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    console.error("Unexpected error in GET /api/replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()

    const sanitizedBody = sanitizeRequestBody(body, ["content"])

    const validatedData = validateAndSanitize(replyValidation, sanitizedBody)

    if (!validatedData.success) {
      return NextResponse.json({ error: "Validation failed", details: validatedData.errors }, { status: 400 })
    }

    const { data: note, error: noteError } = await db
      .from("personal_sticks")
      .select("user_id, is_shared, org_id")
      .eq("id", validatedData.data.note_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    if (note.user_id !== user.id && !note.is_shared) {
      return NextResponse.json({ error: "Cannot reply to this note" }, { status: 403 })
    }

    const { data: reply, error } = await db
      .from("personal_sticks_replies")
      .insert({
        personal_stick_id: validatedData.data.note_id,
        content: validatedData.data.content,
        color: validatedData.data.color || "#ffffff",
        user_id: user.id,
        org_id: orgContext.orgId,
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error creating reply:", error)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    console.error("Unexpected error in POST /api/replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

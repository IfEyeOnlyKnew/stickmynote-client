// Shared handler logic for personal note replies (v1 + v2 deduplication)
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Shared auth + org guard
async function getAuthAndOrg(): Promise<
  { error: NextResponse } | { user: { id: string; email?: string }; orgId: string }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// Check note access (ownership or shared)
async function checkNoteAccess(noteId: string, userId: string, orgId: string) {
  const note = await querySingle(
    `SELECT user_id, is_shared, org_id FROM personal_sticks WHERE id = $1 AND org_id = $2`,
    [noteId, orgId],
  )

  if (!note) return { error: "Note not found" as const, status: 404 as const }

  if (note.user_id !== userId && !note.is_shared) {
    return { error: "Access denied" as const, status: 403 as const }
  }

  return { note }
}

// GET - Fetch replies for a personal note
export async function handleGetReplies(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get("note_id")

    if (!noteId || !UUID_REGEX.test(noteId)) {
      return NextResponse.json({ error: "Valid note ID is required" }, { status: 400 })
    }

    const noteAccess = await checkNoteAccess(noteId, auth.user.id, auth.orgId)
    if ("error" in noteAccess) {
      return NextResponse.json({ error: noteAccess.error }, { status: noteAccess.status })
    }

    // Get replies with user info
    const replies = await query(
      `SELECT r.*, u.username, u.email
       FROM personal_sticks_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.personal_stick_id = $1 AND r.org_id = $2
       ORDER BY r.created_at ASC`,
      [noteId, auth.orgId],
    )

    const repliesWithUsers = replies.map((r: any) => ({
      ...r,
      user: r.username ? { username: r.username, email: r.email } : null,
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    console.error("Unexpected error in GET replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a reply on a personal note
export async function handleCreateReply(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { note_id, content, color = "#ffffff" } = body

    if (!note_id || !UUID_REGEX.test(note_id)) {
      return NextResponse.json({ error: "Valid note ID is required" }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const noteAccess = await checkNoteAccess(note_id, auth.user.id, auth.orgId)
    if ("error" in noteAccess) {
      const errorMsg = noteAccess.status === 403 ? "Cannot reply to this note" : noteAccess.error
      return NextResponse.json({ error: errorMsg }, { status: noteAccess.status })
    }

    const reply = await querySingle(
      `INSERT INTO personal_sticks_replies (personal_stick_id, content, color, user_id, org_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [note_id, content.trim(), color, auth.user.id, auth.orgId],
    )

    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    console.error("Unexpected error in POST replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

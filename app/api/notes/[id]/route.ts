import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { sanitizeRequestBody } from "@/lib/html-sanitizer"
import {
  getNoteWithDetails,
  checkNoteDLP,
  updateNoteFields,
  deleteNoteById,
} from "@/lib/handlers/notes-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================================
// Auth + validation helper shared by all methods
// ============================================================================

async function authenticateAndValidate(context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const params = await context.params
  const noteId = params.id
  if (!validateUUID(noteId)) {
    return { error: NextResponse.json({ error: "Invalid note ID" }, { status: 400 }) }
  }

  return { session, noteId }
}

// ============================================================================
// GET - Fetch single note
// ============================================================================

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAndValidate(context)
    if ("error" in auth) return auth.error

    const note = await getNoteWithDetails(auth.noteId, auth.session.user.id)
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (err) {
    console.error("GET /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PUT - Full update of note
// ============================================================================

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAndValidate(context)
    if ("error" in auth) return auth.error

    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body, ["topic", "content"])

    const dlp = await checkNoteDLP(auth.noteId, auth.session.user.id, sanitizedBody)
    if (!dlp.allowed) {
      return NextResponse.json({ error: dlp.reason }, { status: 403 })
    }

    const result = await updateNoteFields(auth.noteId, auth.session.user.id, sanitizedBody)
    if (!result) {
      return NextResponse.json({ error: "Note not found or update failed" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("PUT /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Partial update of note
// ============================================================================

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAndValidate(context)
    if ("error" in auth) return auth.error

    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body, ["topic", "content"])

    const dlp = await checkNoteDLP(auth.noteId, auth.session.user.id, sanitizedBody)
    if (!dlp.allowed) {
      return NextResponse.json({ error: dlp.reason }, { status: 403 })
    }

    const result = await updateNoteFields(auth.noteId, auth.session.user.id, sanitizedBody)
    if (!result) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("PATCH /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete note
// ============================================================================

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAndValidate(context)
    if ("error" in auth) return auth.error

    const { status, body } = await deleteNoteById(auth.noteId, auth.session.user.id)
    return NextResponse.json(body, { status })
  } catch (err) {
    console.error("DELETE /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

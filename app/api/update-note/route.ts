import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// POST /api/update-note
// Body: { noteId: string, topic?: string, content?: string }
export async function POST(request: NextRequest) {
  try {
    console.log("[v0] POST /api/update-note - Request received")

    const supabase = await createClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser(supabase)

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      console.error("[v0] Authentication failed:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    console.log("[v0] Request body:", { noteId: body?.noteId, hasTopic: !!body?.topic, hasContent: !!body?.content })

    const noteId = String(body?.noteId || "")
    const topic = body?.topic !== undefined ? String(body.topic) : undefined
    const content = body?.content !== undefined ? String(body.content) : undefined

    // Validate noteId
    if (!noteId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(noteId)) {
      console.error("[v0] Invalid noteId:", noteId)
      return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    }

    // Get the note to verify ownership
    const { data: note, error: fetchError } = await supabase
      .from("personal_sticks")
      .select("id, user_id, is_shared")
      .eq("id", noteId)
      .maybeSingle()

    console.log("[v0] Note fetch result:", {
      found: !!note,
      noteUserId: note?.user_id,
      requestUserId: user.id,
      isOwner: note?.user_id === user.id,
      fetchError: fetchError?.message,
    })

    if (fetchError || !note) {
      console.error("[v0] Note not found:", fetchError)
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    // Check if user owns the note
    if (note.user_id !== user.id) {
      console.error("[v0] Ownership check failed")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (topic !== undefined) {
      updates.topic = topic
    }

    if (content !== undefined) {
      updates.content = content
    }

    console.log("[v0] Updating note with:", updates)

    // Update the note
    const { data: updatedNote, error: updateError } = await supabase
      .from("personal_sticks")
      .update(updates)
      .eq("id", noteId)
      .select("*")
      .maybeSingle()

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log("[v0] Note updated successfully:", updatedNote.id)
    return NextResponse.json(updatedNote)
  } catch (err) {
    console.error("[v0] POST /api/update-note error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

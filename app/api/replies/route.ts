import type { NextRequest } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { replyValidation, validateAndSanitize, validateUUID } from "@/lib/input-validation-enhanced"
import { NextResponse } from "next/server"
import { sanitizeRequestBody } from "@/lib/html-sanitizer"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()

    const authResult = await getCachedAuthUser(supabase)

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

    const { data: note, error: noteError } = await supabase
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

    const { data: replies, error } = await supabase
      .from("personal_sticks_replies")
      .select(`
        *,
        user:users(username, email)
      `)
      .eq("personal_stick_id", noteId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching replies:", error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    return NextResponse.json({ replies })
  } catch (error) {
    console.error("Unexpected error in GET /api/replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()

    const authResult = await getCachedAuthUser(supabase)

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

    const { data: note, error: noteError } = await supabase
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

    const { data: reply, error } = await supabase
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

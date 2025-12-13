import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { noteValidation, validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { sanitizeRequestBody } from "@/lib/html-sanitizer"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const notePartialSchema = noteValidation.partial()

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch (err) {
    console.warn("Rate limit provider error, allowing request:", err)
    return true
  }
}

// ============================================================================
// GET - Fetch single note
// ============================================================================

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const params = await context.params
    const noteId = params.id
    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    if (!(await safeRateLimit(request, user.id, "notes_read"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const supabase = await createSupabaseServer()

    const { data: note, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (error || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("GET /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PUT - Full update of note
// ============================================================================

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const params = await context.params
    const noteId = params.id
    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "notes_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body, ["topic", "content"])
    const parsed = noteValidation.safeParse(sanitizedBody)

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createSupabaseServer()

    const update: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }

    const { data: note, error } = await supabase
      .from("notes")
      .update(update)
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error || !note) {
      return NextResponse.json({ error: "Note not found or update failed" }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("PUT /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Partial update of note
// ============================================================================

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const params = await context.params
    const noteId = params.id

    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    if (!(await safeRateLimit(request, user.id, "notes_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const sanitizedBody = sanitizeRequestBody(body, ["topic", "content"])
    const parsed = notePartialSchema.safeParse(sanitizedBody)

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createSupabaseServer()

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if ("topic" in parsed.data && parsed.data.topic !== undefined) update.topic = parsed.data.topic
    if ("content" in parsed.data && parsed.data.content !== undefined) update.content = parsed.data.content
    if ("color" in parsed.data && parsed.data.color !== undefined) update.color = parsed.data.color
    if ("position_x" in parsed.data && parsed.data.position_x !== undefined) update.position_x = parsed.data.position_x
    if ("position_y" in parsed.data && parsed.data.position_y !== undefined) update.position_y = parsed.data.position_y
    if ("is_shared" in parsed.data && parsed.data.is_shared !== undefined) update.is_shared = parsed.data.is_shared

    const { data: note, error } = await supabase
      .from("notes")
      .update(update)
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Note not found or update failed", details: error.message }, { status: 404 })
    }

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("PATCH /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete note
// ============================================================================

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Validate CSRF token for note deletion
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

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const params = await context.params
    const noteId = params.id
    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "notes_delete"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const supabase = await createSupabaseServer()

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error("Error deleting note:", error)
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
    }

    return NextResponse.json({ message: "Note deleted successfully" })
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("DELETE /api/notes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

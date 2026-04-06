import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { isUnderLegalHold } from "@/lib/legal-hold/check-hold"
import { buildPatchUpdateData, canEditStick, canDeleteStick } from "@/lib/handlers/stick-detail-handler"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch (err) {
    console.warn("Rate limit provider error, allowing request:", err)
    return true
  }
}

// Shared auth + validation guard for PUT/PATCH/DELETE
async function authenticateAndValidate(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  rateLimitAction: string,
): Promise<{ user: { id: string }; orgId: string; stickId: string } | { response: NextResponse }> {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { response: createRateLimitResponse() }
  if (!user) return { response: createUnauthorizedResponse() }

  const orgContext = await getOrgContext()
  if (!orgContext) return { response: NextResponse.json({ error: "No organization context" }, { status: 403 }) }

  const params = await context.params
  const stickId = params.id
  if (!validateUUID(stickId)) return { response: NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 }) }

  if (!(await safeRateLimit(request, user.id, rateLimitAction))) {
    return { response: NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } }) }
  }

  return { user, orgId: orgContext.orgId, stickId }
}

// Fetch stick + pad + membership and check edit permission
async function checkStickEditPermission(
  db: Awaited<ReturnType<typeof createServiceDatabaseClient>>,
  stickId: string,
  userId: string,
  orgId: string,
): Promise<{ stick: any } | { response: NextResponse }> {
  const { data: stick } = await db
    .from("paks_pad_sticks")
    .select("user_id, pad_id, org_id")
    .eq("id", stickId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!stick) return { response: NextResponse.json({ error: "Stick not found" }, { status: 404 }) }

  const { data: pad } = await db
    .from("paks_pads")
    .select("owner_id")
    .eq("id", stick.pad_id)
    .eq("org_id", orgId)
    .maybeSingle()

  const { data: membership } = await db
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", stick.pad_id)
    .eq("user_id", userId)
    .eq("accepted", true)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!canEditStick(stick.user_id, pad?.owner_id, membership?.role, userId)) {
    return { response: NextResponse.json({ error: "Permission denied" }, { status: 403 }) }
  }

  return { stick: { ...stick, pad_owner_id: pad?.owner_id, member_role: membership?.role } }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await authenticateAndValidate(request, context, "sticks_delete")
    if ("response" in guard) return guard.response
    const { user, orgId, stickId } = guard

    const db = await createServiceDatabaseClient()

    const { data: stick, error: fetchError } = await db
      .from("paks_pad_sticks")
      .select("id, user_id, pad_id, org_id")
      .eq("id", stickId)
      .eq("org_id", orgId)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching Stick:", fetchError)
      return NextResponse.json({ error: "Failed to fetch Stick" }, { status: 500 })
    }

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const { data: pad } = await db
      .from("paks_pads")
      .select("owner_id")
      .eq("id", stick.pad_id)
      .eq("org_id", orgId)
      .maybeSingle()

    const { data: membership } = await db
      .from("paks_pad_members")
      .select("role")
      .eq("pad_id", stick.pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgId)
      .maybeSingle()

    if (!canDeleteStick(stick.user_id, pad?.owner_id, membership?.role, user.id)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    if (await isUnderLegalHold(user.id, orgId)) {
      return NextResponse.json({ error: "Content cannot be deleted: active legal hold" }, { status: 403 })
    }

    const { error } = await db.from("paks_pad_sticks").delete().eq("id", stickId).eq("org_id", orgId)

    if (error) {
      console.error("Error deleting Stick:", error)
      return NextResponse.json({ error: "Failed to delete Stick" }, { status: 500 })
    }

    return NextResponse.json({ message: "Stick deleted successfully" })
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("DELETE /api/sticks/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await authenticateAndValidate(request, context, "sticks_update")
    if ("response" in guard) return guard.response
    const { user, orgId, stickId } = guard

    const body = await request.json()
    const { topic, content, details, color } = body

    const db = await createServiceDatabaseClient()

    const permCheck = await checkStickEditPermission(db, stickId, user.id, orgId)
    if ("response" in permCheck) return permCheck.response

    const { data: updatedStick, error } = await db
      .from("paks_pad_sticks")
      .update({
        topic,
        content,
        details,
        color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stickId)
      .eq("org_id", orgId)
      .select()
      .single()

    if (error) {
      console.error("Error updating Stick:", error)
      return NextResponse.json({ error: "Failed to update Stick" }, { status: 500 })
    }

    return NextResponse.json({ stick: updatedStick })
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("PUT /api/sticks/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await authenticateAndValidate(request, context, "sticks_update")
    if ("response" in guard) return guard.response
    const { user, orgId, stickId } = guard

    const body = await request.json()
    const db = await createServiceDatabaseClient()

    const permCheck = await checkStickEditPermission(db, stickId, user.id, orgId)
    if ("response" in permCheck) return permCheck.response

    const updateData = buildPatchUpdateData(body)

    const { data: updatedStick, error } = await db
      .from("paks_pad_sticks")
      .update(updateData)
      .eq("id", stickId)
      .eq("org_id", orgId)
      .select()
      .single()

    if (error) {
      console.error("Error updating Stick:", error)
      return NextResponse.json({ error: "Failed to update Stick" }, { status: 500 })
    }

    return NextResponse.json({ stick: updatedStick })
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("PATCH /api/sticks/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

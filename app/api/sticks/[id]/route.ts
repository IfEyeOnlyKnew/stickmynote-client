import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch (err) {
    console.warn("Rate limit provider error, allowing request:", err)
    return true
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const stickId = params.id
    if (!validateUUID(stickId)) return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "sticks_delete"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const db = await createServiceDatabaseClient()

    const { data: stick, error: fetchError } = await db
      .from("paks_pad_sticks")
      .select("id, user_id, pad_id, org_id")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching Stick:", fetchError)
      return NextResponse.json({ error: "Failed to fetch Stick" }, { status: 500 })
    }

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const isStickOwner = stick.user_id === user.id

    const { data: pad } = await db
      .from("paks_pads")
      .select("owner_id")
      .eq("id", stick.pad_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const isPadOwner = pad?.owner_id === user.id

    const { data: membership } = await db
      .from("paks_pad_members")
      .select("role")
      .eq("pad_id", stick.pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const isPadAdmin = membership?.role === "admin"

    if (!isStickOwner && !isPadOwner && !isPadAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error } = await db.from("paks_pad_sticks").delete().eq("id", stickId).eq("org_id", orgContext.orgId)

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
    const stickId = params.id
    if (!validateUUID(stickId)) return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "sticks_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const { topic, content, details, color } = body

    const db = await createServiceDatabaseClient()

    const { data: stick } = await db
      .from("paks_pad_sticks")
      .select("user_id, pad_id, org_id")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const isStickOwner = stick.user_id === user.id

    const { data: pad } = await db
      .from("paks_pads")
      .select("owner_id")
      .eq("id", stick.pad_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()
    const isPadOwner = pad?.owner_id === user.id

    const { data: membership } = await db
      .from("paks_pad_members")
      .select("role")
      .eq("pad_id", stick.pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canEdit = isStickOwner || isPadOwner || membership?.role === "admin" || membership?.role === "edit"

    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

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
      .eq("org_id", orgContext.orgId)
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
    const stickId = params.id
    if (!validateUUID(stickId)) return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "sticks_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()

    const db = await createServiceDatabaseClient()

    const { data: stick } = await db
      .from("paks_pad_sticks")
      .select("user_id, pad_id, org_id")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const isStickOwner = stick.user_id === user.id

    const { data: pad } = await db
      .from("paks_pads")
      .select("owner_id")
      .eq("id", stick.pad_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()
    const isPadOwner = pad?.owner_id === user.id

    const { data: membership } = await db
      .from("paks_pad_members")
      .select("role")
      .eq("pad_id", stick.pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canEdit = isStickOwner || isPadOwner || membership?.role === "admin" || membership?.role === "edit"

    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.topic !== undefined) updateData.topic = body.topic
    if (body.content !== undefined) updateData.content = body.content
    if (body.details !== undefined) updateData.details = body.details
    if (body.color !== undefined) updateData.color = body.color
    if (body.is_quickstick !== undefined) updateData.is_quickstick = body.is_quickstick

    const { data: updatedStick, error } = await db
      .from("paks_pad_sticks")
      .update(updateData)
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
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

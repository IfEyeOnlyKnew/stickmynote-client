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
  } catch {
    return true
  }
}

// PUT /api/noted/groups/[id] - Update a group
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "noted_group_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const { name, color, sort_order } = body

    const db = await createServiceDatabaseClient()

    // Build update object
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name.trim()
    if (color !== undefined) updateData.color = color
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data, error } = await db
      .from("noted_groups")
      .update(updateData)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .select("*")
      .single()

    if (error) {
      console.error("Error updating group:", error)
      return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
    }

    if (!data) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error("PUT /api/noted/groups/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/noted/groups/[id] - Delete a group (pages become ungrouped)
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "noted_group_delete"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const db = await createServiceDatabaseClient()

    // Verify ownership
    const { data: group } = await db
      .from("noted_groups")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    // Pages with this group_id will have group_id set to NULL (ON DELETE SET NULL)
    const { error } = await db
      .from("noted_groups")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error("Error deleting group:", error)
      return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
    }

    return NextResponse.json({ message: "Group deleted" })
  } catch (err) {
    console.error("DELETE /api/noted/groups/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

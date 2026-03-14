import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[ConcurStick]"

// ============================================================================
// Auth Helpers
// ============================================================================

async function getAuthenticatedOrgContext() {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { error: "RATE_LIMITED" as const }
  if (!user) return { error: "UNAUTHORIZED" as const }

  const orgContext = await getOrgContext()
  if (!orgContext) return { error: "NO_ORG" as const }

  return { user, orgContext }
}

async function checkGroupMembership(db: any, groupId: string, userId: string, orgId: string) {
  const { data } = await db
    .from("concur_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()
  return data
}

// ============================================================================
// GET - Get single stick
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId, stickId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return createRateLimitResponse()
      if (authResult.error === "UNAUTHORIZED") return createUnauthorizedResponse()
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 })

    const { data: stick, error } = await db
      .from("concur_sticks")
      .select("*")
      .eq("id", stickId)
      .eq("group_id", groupId)
      .maybeSingle()

    if (error || !stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    return NextResponse.json({ stick })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return NextResponse.json({ error: "Failed to fetch stick" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Edit stick (author or group owner)
// ============================================================================

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId, stickId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return createRateLimitResponse()
      if (authResult.error === "UNAUTHORIZED") return createUnauthorizedResponse()
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 })

    // Fetch stick to check ownership
    const { data: existing } = await db
      .from("concur_sticks")
      .select("user_id")
      .eq("id", stickId)
      .eq("group_id", groupId)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: "Stick not found" }, { status: 404 })

    // Only author or group owner can edit
    if (existing.user_id !== user.id && membership.role !== "owner") {
      return NextResponse.json({ error: "You can only edit your own sticks" }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.topic !== undefined) updates.topic = body.topic?.trim() || null
    if (body.content !== undefined) updates.content = body.content.trim()
    if (body.color !== undefined) updates.color = body.color
    if (body.is_pinned !== undefined) {
      updates.is_pinned = body.is_pinned
      if (body.is_pinned) {
        updates.pinned_by = user.id
        updates.pinned_at = new Date().toISOString()
      } else {
        updates.pinned_by = null
        updates.pinned_at = null
      }
    }

    const { data: stick, error } = await db
      .from("concur_sticks")
      .update(updates)
      .eq("id", stickId)
      .eq("group_id", groupId)
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error updating stick:`, error)
      return NextResponse.json({ error: "Failed to update stick" }, { status: 500 })
    }

    return NextResponse.json({ stick })
  } catch (error) {
    console.error(`${LOG_PREFIX} PATCH error:`, error)
    return NextResponse.json({ error: "Failed to update stick" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete stick (author or group owner)
// ============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const { groupId, stickId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return createRateLimitResponse()
      if (authResult.error === "UNAUTHORIZED") return createUnauthorizedResponse()
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 })

    // Fetch stick to check ownership
    const { data: existing } = await db
      .from("concur_sticks")
      .select("user_id")
      .eq("id", stickId)
      .eq("group_id", groupId)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: "Stick not found" }, { status: 404 })

    if (existing.user_id !== user.id && membership.role !== "owner") {
      return NextResponse.json({ error: "You can only delete your own sticks" }, { status: 403 })
    }

    const { error } = await db
      .from("concur_sticks")
      .delete()
      .eq("id", stickId)
      .eq("group_id", groupId)

    if (error) {
      console.error(`${LOG_PREFIX} Error deleting stick:`, error)
      return NextResponse.json({ error: "Failed to delete stick" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE error:`, error)
    return NextResponse.json({ error: "Failed to delete stick" }, { status: 500 })
  }
}

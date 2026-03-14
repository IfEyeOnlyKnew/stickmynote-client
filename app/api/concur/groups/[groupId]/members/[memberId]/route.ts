import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[ConcurGroupMember]"

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

// ============================================================================
// PATCH - Update member role (promote to owner)
// ============================================================================

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const { groupId, memberId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return createRateLimitResponse()
      if (authResult.error === "UNAUTHORIZED") return createUnauthorizedResponse()
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    // Check caller is owner
    const { data: callerMembership } = await db
      .from("concur_group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!callerMembership || callerMembership.role !== "owner") {
      return NextResponse.json({ error: "Only group owners can change member roles" }, { status: 403 })
    }

    const { role } = await request.json()
    if (!role || !["owner", "member"].includes(role)) {
      return NextResponse.json({ error: "Role must be 'owner' or 'member'" }, { status: 400 })
    }

    const { data: member, error } = await db
      .from("concur_group_members")
      .update({ role })
      .eq("id", memberId)
      .eq("group_id", groupId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error updating role:`, error)
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error(`${LOG_PREFIX} PATCH error:`, error)
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Remove member from group (owners only)
// ============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const { groupId, memberId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return createRateLimitResponse()
      if (authResult.error === "UNAUTHORIZED") return createUnauthorizedResponse()
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    // Check caller is owner
    const { data: callerMembership } = await db
      .from("concur_group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!callerMembership || callerMembership.role !== "owner") {
      return NextResponse.json({ error: "Only group owners can remove members" }, { status: 403 })
    }

    const { error } = await db
      .from("concur_group_members")
      .delete()
      .eq("id", memberId)
      .eq("group_id", groupId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error(`${LOG_PREFIX} Error removing member:`, error)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE error:`, error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}

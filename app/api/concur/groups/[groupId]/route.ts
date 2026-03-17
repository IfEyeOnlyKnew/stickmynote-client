import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// Constants & Errors
// ============================================================================

const LOG_PREFIX = "[ConcurGroup]"

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  notFound: () => NextResponse.json({ error: "Group not found" }, { status: 404 }),
  forbidden: () => NextResponse.json({ error: "Access denied" }, { status: 403 }),
  ownersOnly: () => NextResponse.json({ error: "Only group owners can perform this action" }, { status: 403 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch group" }, { status: 500 }),
  updateFailed: () => NextResponse.json({ error: "Failed to update group" }, { status: 500 }),
  deleteFailed: () => NextResponse.json({ error: "Failed to delete group" }, { status: 500 }),
}

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
// GET - Get group details
// ============================================================================

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    // Check membership
    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return Errors.forbidden()

    // Fetch group
    const { data: group, error } = await db
      .from("concur_groups")
      .select("*")
      .eq("id", groupId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (error || !group) return Errors.notFound()

    // Fetch member count
    const { data: members } = await db
      .from("concur_group_members")
      .select("id")
      .eq("group_id", groupId)

    return NextResponse.json({
      group: {
        ...group,
        user_role: membership.role,
        member_count: members?.length || 0,
      },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return Errors.fetchFailed()
  }
}

// ============================================================================
// PATCH - Update group (owners only)
// ============================================================================

export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership || membership.role !== "owner") return Errors.ownersOnly()

    const { name, description, logo_url, header_image_url } = await request.json()

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null

    // Merge image URLs into settings JSONB
    if (logo_url !== undefined || header_image_url !== undefined) {
      // Fetch current settings first to merge
      const { data: current } = await db
        .from("concur_groups")
        .select("settings")
        .eq("id", groupId)
        .single()

      const currentSettings = current?.settings || {}
      const newSettings = { ...currentSettings }
      if (logo_url !== undefined) newSettings.logo_url = logo_url || null
      if (header_image_url !== undefined) newSettings.header_image_url = header_image_url || null
      updates.settings = newSettings
    }

    const { data: group, error } = await db
      .from("concur_groups")
      .update(updates)
      .eq("id", groupId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error updating group:`, error)
      return Errors.updateFailed()
    }

    return NextResponse.json({ group })
  } catch (error) {
    console.error(`${LOG_PREFIX} PATCH error:`, error)
    return Errors.updateFailed()
  }
}

// ============================================================================
// DELETE - Delete group (owners only)
// ============================================================================

export async function DELETE(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership || membership.role !== "owner") return Errors.ownersOnly()

    const { error } = await db
      .from("concur_groups")
      .delete()
      .eq("id", groupId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error(`${LOG_PREFIX} Error deleting group:`, error)
      return Errors.deleteFailed()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE error:`, error)
    return Errors.deleteFailed()
  }
}

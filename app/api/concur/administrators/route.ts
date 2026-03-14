import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[ConcurAdministrators]"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  forbidden: () => NextResponse.json({ error: "Only organization owners or admins can manage Concur administrators" }, { status: 403 }),
  emailRequired: () => NextResponse.json({ error: "Email address is required" }, { status: 400 }),
  userNotFound: () => NextResponse.json({ error: "No user found with that email in this organization" }, { status: 404 }),
  alreadyAdmin: () => NextResponse.json({ error: "User is already a Concur administrator" }, { status: 409 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch Concur administrators" }, { status: 500 }),
  addFailed: () => NextResponse.json({ error: "Failed to add Concur administrator" }, { status: 500 }),
  removeFailed: () => NextResponse.json({ error: "Failed to remove Concur administrator" }, { status: 500 }),
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

async function checkOrgOwnerOrAdmin(orgId: string, userId: string) {
  const db = await createDatabaseClient()
  const { data: membership } = await db
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()

  return membership?.role === "owner" || membership?.role === "admin"
}

// ============================================================================
// GET - List Concur administrators
// ============================================================================

export async function GET() {
  try {
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult

    const isOwnerOrAdmin = await checkOrgOwnerOrAdmin(orgContext.orgId, user.id)
    if (!isOwnerOrAdmin) return Errors.forbidden()

    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    const { data: admins, error } = await db
      .from("concur_administrators")
      .select("*")
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(`${LOG_PREFIX} Error fetching administrators:`, error)
      return Errors.fetchFailed()
    }

    // Enrich with user data
    const userIds = (admins || []).map((a: any) => a.user_id)
    if (userIds.length === 0) {
      return NextResponse.json({ administrators: [] })
    }

    const { data: users } = await serviceDb
      .from("users")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds)

    const userMap = new Map((users || []).map((u: any) => [u.id, u]))

    const enrichedAdmins = (admins || []).map((admin: any) => ({
      ...admin,
      user: userMap.get(admin.user_id) || null,
    }))

    return NextResponse.json({ administrators: enrichedAdmins })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return Errors.fetchFailed()
  }
}

// ============================================================================
// POST - Add a Concur administrator by email
// ============================================================================

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult

    const isOwnerOrAdmin = await checkOrgOwnerOrAdmin(orgContext.orgId, user.id)
    if (!isOwnerOrAdmin) return Errors.forbidden()

    const { email } = await request.json()
    if (!email?.trim()) return Errors.emailRequired()

    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    // Find user by email
    const { data: targetUser } = await serviceDb
      .from("users")
      .select("id, full_name, email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle()

    if (!targetUser) return Errors.userNotFound()

    // Check they're in the org
    const { data: membership } = await db
      .from("organization_members")
      .select("id")
      .eq("org_id", orgContext.orgId)
      .eq("user_id", targetUser.id)
      .maybeSingle()

    if (!membership) return Errors.userNotFound()

    // Check if already an administrator
    const { data: existing } = await db
      .from("concur_administrators")
      .select("id")
      .eq("user_id", targetUser.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (existing) return Errors.alreadyAdmin()

    // Add as administrator
    const { data: admin, error } = await db
      .from("concur_administrators")
      .insert({
        user_id: targetUser.id,
        org_id: orgContext.orgId,
        granted_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error adding administrator:`, error)
      return Errors.addFailed()
    }

    return NextResponse.json({
      administrator: {
        ...admin,
        user: targetUser,
      },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.addFailed()
  }
}

// ============================================================================
// DELETE - Remove a Concur administrator
// ============================================================================

export async function DELETE(request: Request) {
  try {
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult

    const isOwnerOrAdmin = await checkOrgOwnerOrAdmin(orgContext.orgId, user.id)
    if (!isOwnerOrAdmin) return Errors.forbidden()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const db = await createDatabaseClient()

    const { error } = await db
      .from("concur_administrators")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error(`${LOG_PREFIX} Error removing administrator:`, error)
      return Errors.removeFailed()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE error:`, error)
    return Errors.removeFailed()
  }
}

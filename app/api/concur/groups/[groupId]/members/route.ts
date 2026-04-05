import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// Constants & Errors
// ============================================================================

const LOG_PREFIX = "[ConcurGroupMembers]"

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  forbidden: () => NextResponse.json({ error: "Access denied" }, { status: 403 }),
  ownersOnly: () => NextResponse.json({ error: "Only group owners can add members" }, { status: 403 }),
  emailRequired: () => NextResponse.json({ error: "Email address is required" }, { status: 400 }),
  userNotFound: (email: string) => NextResponse.json({ error: `User not found in organization: ${email}` }, { status: 404 }),
  alreadyMember: () => NextResponse.json({ error: "User is already a member of this group" }, { status: 409 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch members" }, { status: 500 }),
  addFailed: () => NextResponse.json({ error: "Failed to add member" }, { status: 500 }),
}

// ============================================================================
// Auth & Access Helpers
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
// GET - List group members
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
    const serviceDb = await createServiceDatabaseClient()

    // Check caller is a member
    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return Errors.forbidden()

    // Fetch all members
    const { data: members, error } = await db
      .from("concur_group_members")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error(`${LOG_PREFIX} Error fetching members:`, error)
      return Errors.fetchFailed()
    }

    // Enrich with user data
    const userIds = (members || []).map((m: any) => m.user_id)
    if (userIds.length === 0) {
      return NextResponse.json({ members: [] })
    }

    const { data: users } = await serviceDb
      .from("users")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds)

    const userMap = new Map((users || []).map((u: any) => [u.id, u]))

    const enrichedMembers = (members || []).map((member: any) => ({
      ...member,
      user: userMap.get(member.user_id) || null,
    }))

    return NextResponse.json({ members: enrichedMembers })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return Errors.fetchFailed()
  }
}

// ============================================================================
// POST - Add a member by email (owners only)
// ============================================================================

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
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
    const serviceDb = await createServiceDatabaseClient()

    // Check caller is owner
    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (membership?.role !== "owner") return Errors.ownersOnly()

    const { email, role } = await request.json()
    if (!email?.trim()) return Errors.emailRequired()

    // Lookup user
    const { data: targetUser } = await serviceDb
      .from("users")
      .select("id, full_name, email, avatar_url")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle()

    if (!targetUser) return Errors.userNotFound(email)

    // Check they're in the org
    const { data: orgMembership } = await db
      .from("organization_members")
      .select("id")
      .eq("org_id", orgContext.orgId)
      .eq("user_id", targetUser.id)
      .maybeSingle()

    if (!orgMembership) return Errors.userNotFound(email)

    // Check if already a member
    const existing = await checkGroupMembership(db, groupId, targetUser.id, orgContext.orgId)
    if (existing) return Errors.alreadyMember()

    // Add member
    const { data: member, error } = await db
      .from("concur_group_members")
      .insert({
        group_id: groupId,
        user_id: targetUser.id,
        org_id: orgContext.orgId,
        role: role === "owner" ? "owner" : "member",
        added_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error adding member:`, error)
      return Errors.addFailed()
    }

    return NextResponse.json({
      member: {
        ...member,
        user: targetUser,
      },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.addFailed()
  }
}

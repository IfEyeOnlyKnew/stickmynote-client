import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"
import { isConcurAdmin } from "@/lib/concur/concur-auth"
import { ensureUserProvisioned } from "@/lib/auth/ldap-auth"

// ============================================================================
// Types
// ============================================================================

interface ConcurGroup {
  id: string
  name: string
  description: string | null
  org_id: string
  created_by: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Constants & Errors
// ============================================================================

const LOG_PREFIX = "[ConcurGroups]"

async function addGroupOwners(db: any, groupId: string, orgId: string, addedBy: string, owner1Id: string, owner2Id: string): Promise<boolean> {
  const { error: err1 } = await db.from("concur_group_members").insert({ group_id: groupId, user_id: owner1Id, org_id: orgId, role: "owner", added_by: addedBy })
  if (err1) return true

  if (owner1Id !== owner2Id) {
    const { error: err2 } = await db.from("concur_group_members").insert({ group_id: groupId, user_id: owner2Id, org_id: orgId, role: "owner", added_by: addedBy })
    if (err2) return true
  }

  return false
}

async function addAdminsToGroup(db: any, groupId: string, orgId: string, addedBy: string, ownerIds: string[]): Promise<void> {
  const ownerSet = new Set(ownerIds)
  const { data: admins } = await db.from("concur_administrators").select("user_id").eq("org_id", orgId)
  if (!admins?.length) return

  for (const admin of admins) {
    if (ownerSet.has(admin.user_id)) continue
    await db.from("concur_group_members").insert({ group_id: groupId, user_id: admin.user_id, org_id: orgId, role: "owner", added_by: addedBy })
  }
}

function handleConcurAuthError(error: string | undefined): NextResponse {
  if (error === "RATE_LIMITED") return Errors.rateLimit()
  if (error === "UNAUTHORIZED") return Errors.unauthorized()
  return Errors.noOrgContext()
}

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  forbidden: () => NextResponse.json({ error: "Only Concur administrators can create groups" }, { status: 403 }),
  missingFields: () => NextResponse.json({ error: "Group name, owner1Email, and owner2Email are required" }, { status: 400 }),
  ownerNotFound: (email: string) => NextResponse.json({ error: `User not found: ${email}` }, { status: 404 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 }),
  createFailed: () => NextResponse.json({ error: "Failed to create group" }, { status: 500 }),
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

// ============================================================================
// GET - List groups the user belongs to
// ============================================================================

export async function GET() {
  try {
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) return handleConcurAuthError(authResult.error)

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    // Get groups where user is a member
    const { data: memberships, error: memberError } = await db
      .from("concur_group_members")
      .select("group_id, role")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (memberError) {
      console.error(`${LOG_PREFIX} Error fetching memberships:`, memberError)
      return Errors.fetchFailed()
    }

    // Check if user is a Concur admin (for UI to show Create Group button)
    const isAdmin = await isConcurAdmin(user.id, orgContext.orgId)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ groups: [], isConcurAdmin: isAdmin })
    }

    const groupIds = memberships.map((m: any) => m.group_id)
    const roleMap = new Map(memberships.map((m: any) => [m.group_id, m.role]))

    // Fetch group details
    const { data: groups, error: groupError } = await db
      .from("concur_groups")
      .select("*")
      .in("id", groupIds)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })

    if (groupError) {
      console.error(`${LOG_PREFIX} Error fetching groups:`, groupError)
      return Errors.fetchFailed()
    }

    // Fetch member counts for each group
    const enrichedGroups = await Promise.all(
      (groups || []).map(async (group: ConcurGroup) => {
        const { data: members } = await db
          .from("concur_group_members")
          .select("id")
          .eq("group_id", group.id)

        const { data: sticks } = await db
          .from("concur_sticks")
          .select("id")
          .eq("group_id", group.id)

        // Get latest stick for activity date
        const { data: latestStick } = await db
          .from("concur_sticks")
          .select("created_at")
          .eq("group_id", group.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          ...group,
          user_role: roleMap.get(group.id) || "member",
          member_count: members?.length || 0,
          stick_count: sticks?.length || 0,
          latest_activity: latestStick?.created_at || group.created_at,
        }
      })
    )

    return NextResponse.json({ groups: enrichedGroups, isConcurAdmin: isAdmin })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return Errors.fetchFailed()
  }
}

// ============================================================================
// POST - Create a new group (Concur admin only)
// ============================================================================

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) return handleConcurAuthError(authResult.error)

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    // Check if user is a Concur administrator or org owner
    const isAdmin = await isConcurAdmin(user.id, orgContext.orgId)
    if (!isAdmin) return Errors.forbidden()

    const { name, description, owner1Email, owner2Email } = await request.json()

    if (!name?.trim() || !owner1Email?.trim() || !owner2Email?.trim()) {
      return Errors.missingFields()
    }

    // Lookup owner users by email — auto-provision from LDAP if needed
    const owner1Provisioned = await ensureUserProvisioned(owner1Email, orgContext.orgId)
    if (!owner1Provisioned) return Errors.ownerNotFound(owner1Email)
    const owner2Provisioned = await ensureUserProvisioned(owner2Email, orgContext.orgId)
    if (!owner2Provisioned) return Errors.ownerNotFound(owner2Email)

    const { data: owner1 } = await serviceDb
      .from("users")
      .select("id, email, full_name")
      .eq("id", owner1Provisioned.id)
      .maybeSingle()

    const { data: owner2 } = await serviceDb
      .from("users")
      .select("id, email, full_name")
      .eq("id", owner2Provisioned.id)
      .maybeSingle()

    if (!owner1 || !owner2) return Errors.ownerNotFound(owner1 ? owner2Email : owner1Email)

    // Create group
    const { data: group, error: groupError } = await db
      .from("concur_groups")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        org_id: orgContext.orgId,
        created_by: user.id,
      })
      .select()
      .single()

    console.log(`${LOG_PREFIX} POST: group=`, group, "groupError=", groupError)
    if (groupError || !group) {
      return Errors.createFailed()
    }

    // Add both owners as members with 'owner' role
    const addOwnerError = await addGroupOwners(db, group.id, orgContext.orgId, user.id, owner1.id, owner2.id)
    if (addOwnerError) {
      await db.from("concur_groups").delete().eq("id", group.id)
      return Errors.createFailed()
    }

    // Auto-add Concur administrators as members
    await addAdminsToGroup(db, group.id, orgContext.orgId, user.id, [owner1.id, owner2.id])

    // Broadcast event
    publishToOrg(orgContext.orgId, {
      type: "concur.group_created",
      payload: { groupId: group.id, groupName: group.name, createdBy: user.id },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      group: {
        ...group,
        owners: [owner1, owner2],
      },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.createFailed()
  }
}

import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"
import { isConcurAdmin } from "@/lib/concur/concur-auth"

// ============================================================================
// Constants & Errors
// ============================================================================

const LOG_PREFIX = "[ConcurCreateViaScript]"

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  forbidden: () => NextResponse.json({ error: "Only Concur administrators can create groups" }, { status: 403 }),
  missingFields: () => NextResponse.json({ error: "name, owner1Email, and owner2Email are required" }, { status: 400 }),
  ownerNotFound: (email: string) => NextResponse.json({ error: `User not found in organization: ${email}` }, { status: 404 }),
  createFailed: () => NextResponse.json({ error: "Failed to create group" }, { status: 500 }),
}

// ============================================================================
// POST - Create group via PowerShell script
// ============================================================================

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return Errors.rateLimit()
    if (!user) return Errors.unauthorized()

    const orgContext = await getOrgContext()
    if (!orgContext) return Errors.noOrgContext()

    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    // Verify Concur administrator status (includes org owners)
    const isAdmin = await isConcurAdmin(user.id, orgContext.orgId)
    if (!isAdmin) return Errors.forbidden()

    const { name, description, owner1Email, owner2Email } = await request.json()

    if (!name?.trim() || !owner1Email?.trim() || !owner2Email?.trim()) {
      return Errors.missingFields()
    }

    // Lookup owner users
    const { data: owner1 } = await serviceDb
      .from("users")
      .select("id, email, full_name")
      .eq("email", owner1Email.trim().toLowerCase())
      .maybeSingle()

    if (!owner1) return Errors.ownerNotFound(owner1Email)

    // Verify owner1 is in the org
    const { data: owner1Membership } = await db
      .from("organization_members")
      .select("id")
      .eq("org_id", orgContext.orgId)
      .eq("user_id", owner1.id)
      .maybeSingle()

    if (!owner1Membership) return Errors.ownerNotFound(owner1Email)

    const { data: owner2 } = await serviceDb
      .from("users")
      .select("id, email, full_name")
      .eq("email", owner2Email.trim().toLowerCase())
      .maybeSingle()

    if (!owner2) return Errors.ownerNotFound(owner2Email)

    // Verify owner2 is in the org
    const { data: owner2Membership } = await db
      .from("organization_members")
      .select("id")
      .eq("org_id", orgContext.orgId)
      .eq("user_id", owner2.id)
      .maybeSingle()

    if (!owner2Membership) return Errors.ownerNotFound(owner2Email)

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

    if (groupError || !group) {
      console.error(`${LOG_PREFIX} Error creating group:`, groupError)
      return Errors.createFailed()
    }

    // Add owners (insert one at a time - adapter doesn't support array inserts)
    const { error: owner1Error } = await db
      .from("concur_group_members")
      .insert({ group_id: group.id, user_id: owner1.id, org_id: orgContext.orgId, role: "owner", added_by: user.id })

    if (owner1Error) {
      console.error(`${LOG_PREFIX} Error adding owner1:`, owner1Error)
      await db.from("concur_groups").delete().eq("id", group.id)
      return Errors.createFailed()
    }

    if (owner1.id !== owner2.id) {
      const { error: owner2Error } = await db
        .from("concur_group_members")
        .insert({ group_id: group.id, user_id: owner2.id, org_id: orgContext.orgId, role: "owner", added_by: user.id })

      if (owner2Error) {
        console.error(`${LOG_PREFIX} Error adding owner2:`, owner2Error)
        await db.from("concur_groups").delete().eq("id", group.id)
        return Errors.createFailed()
      }
    }

    // Broadcast
    publishToOrg(orgContext.orgId, {
      type: "concur.group_created",
      payload: { groupId: group.id, groupName: group.name, createdBy: user.id },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        created_at: group.created_at,
        owners: [
          { email: owner1.email, full_name: owner1.full_name },
          { email: owner2.email, full_name: owner2.full_name },
        ],
      },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.createFailed()
  }
}

import { NextResponse } from "next/server"
import { createServiceDatabaseClient, createDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"

// Types
interface OrgMember {
  user_id: string
}

interface PublicUser {
  id: string
  email: string | null
}

interface OrgInvite {
  id: string
  email: string | null
}

interface OrgDomain {
  id: string
  domain: string
}

interface MigrationResult {
  success: boolean
  usersUpdated: number
  invitesUpdated: number
  membersUpdated: number
  domainsUpdated: boolean
  errors: string[]
  details: {
    users: string[]
    invites: string[]
    members: string[]
  }
}

interface MigrationInput {
  oldDomain: string
  newDomain: string
  newOrgName?: string
  dryRun?: boolean
}

interface MigrationData {
  publicUsers: PublicUser[]
  invites: OrgInvite[]
  existingDomains: OrgDomain[]
}

// Constants
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/

// Helper functions
function createInitialResult(): MigrationResult {
  return {
    success: true,
    usersUpdated: 0,
    invitesUpdated: 0,
    membersUpdated: 0,
    domainsUpdated: false,
    errors: [],
    details: { users: [], invites: [], members: [] },
  }
}

function validateDomains(oldDomain: string, newDomain: string): string | null {
  if (!oldDomain || !newDomain) return "Old domain and new domain are required"
  if (!DOMAIN_REGEX.test(oldDomain) || !DOMAIN_REGEX.test(newDomain)) return "Invalid domain format"
  return null
}

function replaceEmailDomain(email: string | null, oldDomain: string, newDomain: string): string | null {
  return email?.replace(`@${oldDomain}`, `@${newDomain}`) ?? null
}

function buildDryRunPreview(data: MigrationData, oldDomain: string, newDomain: string) {
  return {
    dryRun: true,
    preview: {
      users: data.publicUsers.map((u) => ({
        id: u.id,
        oldEmail: u.email,
        newEmail: replaceEmailDomain(u.email, oldDomain, newDomain),
      })),
      invites: data.invites.map((i) => ({
        id: i.id,
        oldEmail: i.email,
        newEmail: replaceEmailDomain(i.email, oldDomain, newDomain),
      })),
      domains: data.existingDomains.length > 0
        ? { oldDomain, newDomain, action: "update" }
        : { oldDomain, newDomain, action: "create" },
      totalAffected: {
        users: data.publicUsers.length,
        invites: data.invites.length,
        domains: data.existingDomains.length > 0 ? 1 : 0,
      },
    },
  }
}

async function fetchMigrationData(
  db: DatabaseClient,
  orgId: string,
  oldDomain: string,
  result: MigrationResult,
): Promise<MigrationData> {
  // Fetch organization members
  const { data: members, error: membersError } = await db
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)

  if (membersError) {
    result.errors.push(`Failed to fetch members: ${membersError.message}`)
  }

  const memberUserIds = (members as OrgMember[] | null)?.map((m) => m.user_id) || []

  // Fetch users with old domain
  let publicUsers: PublicUser[] = []
  if (memberUserIds.length > 0) {
    const { data: pubUsersData, error: pubUsersError } = await db
      .from("users")
      .select("id, email")
      .like("email", `%@${oldDomain}`)
      .in("id", memberUserIds)

    if (pubUsersError) {
      result.errors.push(`Failed to fetch public users: ${pubUsersError.message}`)
    } else {
      publicUsers = (pubUsersData as PublicUser[]) || []
    }
  }

  // Fetch invites with old domain
  const { data: invitesData, error: invitesError } = await db
    .from("organization_invites")
    .select("id, email")
    .eq("org_id", orgId)
    .like("email", `%@${oldDomain}`)

  if (invitesError) {
    result.errors.push(`Failed to fetch invites: ${invitesError.message}`)
  }

  // Fetch existing domain records
  const { data: domainsData, error: domainsError } = await db
    .from("organization_domains")
    .select("id, domain")
    .eq("org_id", orgId)
    .eq("domain", oldDomain)

  if (domainsError) {
    result.errors.push(`Failed to fetch domains: ${domainsError.message}`)
  }

  return {
    publicUsers,
    invites: (invitesData as OrgInvite[]) || [],
    existingDomains: (domainsData as OrgDomain[]) || [],
  }
}

async function migrateUsers(
  db: DatabaseClient,
  users: PublicUser[],
  oldDomain: string,
  newDomain: string,
  result: MigrationResult,
): Promise<void> {
  for (const user of users) {
    const newEmail = replaceEmailDomain(user.email, oldDomain, newDomain)
    if (!newEmail || !user.email) continue

    const { error } = await db.from("users").update({ email: newEmail }).eq("id", user.id)
    if (error) {
      result.errors.push(`User ${user.email}: ${error.message}`)
    } else {
      result.usersUpdated++
      result.details.users.push(`${user.email} → ${newEmail}`)
    }
  }
}

async function migrateInvites(
  db: DatabaseClient,
  invites: OrgInvite[],
  oldDomain: string,
  newDomain: string,
  result: MigrationResult,
): Promise<void> {
  for (const invite of invites) {
    const newEmail = replaceEmailDomain(invite.email, oldDomain, newDomain)
    if (!newEmail || !invite.email) continue

    const { error } = await db.from("organization_invites").update({ email: newEmail }).eq("id", invite.id)
    if (error) {
      result.errors.push(`Invite ${invite.email}: ${error.message}`)
    } else {
      result.invitesUpdated++
      result.details.invites.push(`${invite.email} → ${newEmail}`)
    }
  }
}

async function migrateDomains(
  db: DatabaseClient,
  orgId: string,
  existingDomains: OrgDomain[],
  newDomain: string,
  result: MigrationResult,
): Promise<void> {
  if (existingDomains.length > 0) {
    const { error } = await db
      .from("organization_domains")
      .update({ domain: newDomain })
      .eq("id", existingDomains[0].id)

    if (error) {
      result.errors.push(`Domain update: ${error.message}`)
    } else {
      result.domainsUpdated = true
    }
  } else {
    const { error } = await db.from("organization_domains").insert({
      org_id: orgId,
      domain: newDomain,
      is_primary: true,
    })

    if (error && !error.message?.includes("duplicate")) {
      result.errors.push(`Domain insert: ${error.message}`)
    } else {
      result.domainsUpdated = true
    }
  }
}

async function updateOrgName(
  db: DatabaseClient,
  orgId: string,
  newOrgName: string | undefined,
  result: MigrationResult,
): Promise<void> {
  if (!newOrgName) return

  const { error } = await db.from("organizations").update({ name: newOrgName }).eq("id", orgId)
  if (error) {
    result.errors.push(`Organization name update: ${error.message}`)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const body: MigrationInput = await request.json()
    const { oldDomain, newDomain, newOrgName, dryRun = true } = body

    // Validate inputs
    const validationError = validateDomains(oldDomain, newDomain)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Verify user authorization
    const db = await createDatabaseClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: org } = await db.from("organizations").select("*").eq("id", orgId).single()

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const isOwner = org.owner_id === user.id
    const isSupportContact = user.email === org.support_contact_1_email || user.email === org.support_contact_2_email

    if (!isOwner && !isSupportContact) {
      return NextResponse.json({ error: "Only owners and support contacts can migrate domains" }, { status: 403 })
    }

    // Use service client for admin operations
    const serviceClient = await createServiceDatabaseClient()
    const result = createInitialResult()

    // Fetch all migration data
    const migrationData = await fetchMigrationData(serviceClient, orgId, oldDomain, result)

    // Return preview for dry run
    if (dryRun) {
      return NextResponse.json(buildDryRunPreview(migrationData, oldDomain, newDomain))
    }

    // Execute migration
    await migrateUsers(serviceClient, migrationData.publicUsers, oldDomain, newDomain, result)
    await migrateInvites(serviceClient, migrationData.invites, oldDomain, newDomain, result)
    await migrateDomains(serviceClient, orgId, migrationData.existingDomains, newDomain, result)
    await updateOrgName(serviceClient, orgId, newOrgName, result)

    result.success = result.errors.length === 0

    return NextResponse.json(result)
  } catch (error) {
    console.error("Domain migration error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Migration failed" }, { status: 500 })
  }
}

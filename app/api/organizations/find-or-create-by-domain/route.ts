import { NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { extractDomain, generateOrgNameFromDomain, isPublicEmailDomain } from "@/lib/utils/email-domain"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// ============================================================================
// Types
// ============================================================================

interface AuthUser {
  id: string
  email?: string
}

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  owner_id: string
  settings: Record<string, unknown>
}

interface OrganizationMember {
  id: string
  org_id: string
  user_id: string
  role: string
  joined_at: string
}

interface OrganizationDomainWithOrg {
  org_id: string
  domain: string
  organizations: Organization | Organization[]
}

// ============================================================================
// Constants
// ============================================================================

const RATE_LIMIT_RETRY_SECONDS = "30"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimited: () =>
    NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": RATE_LIMIT_RETRY_SECONDS } }
    ),
  unauthorized: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  emailRequired: () => NextResponse.json({ error: "Email is required" }, { status: 400 }),
  invalidEmail: () => NextResponse.json({ error: "Invalid email format" }, { status: 400 }),
  publicDomain: () =>
    NextResponse.json(
      {
        error: "Public email domains not allowed",
        message: "Please use your company email address to join your organization",
        isPublic: true,
      },
      { status: 400 }
    ),
  databaseError: () => NextResponse.json({ error: "Database error" }, { status: 500 }),
  joinFailed: () => NextResponse.json({ error: "Failed to join organization" }, { status: 500 }),
  createFailed: () => NextResponse.json({ error: "Failed to create organization" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Helpers
// ============================================================================

function generateSlug(domain: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 7)
  return `${domain.replace(/\./g, "-")}-${randomSuffix}`
}

function normalizeOrganization(orgData: Organization | Organization[]): Organization {
  return Array.isArray(orgData) ? orgData[0] : orgData
}

// ============================================================================
// Database Operations
// ============================================================================

async function findOrganizationByDomain(
  db: DatabaseClient,
  domain: string
): Promise<{ org: Organization; domainRecord: OrganizationDomainWithOrg } | null> {
  const { data, error } = await db
    .from("organization_domains")
    .select(`
      org_id,
      domain,
      organizations!inner (*)
    `)
    .eq("domain", domain.toLowerCase())
    .maybeSingle()

  if (error) {
    console.error("[FindOrCreateByDomain] Error finding organization:", error)
    throw error
  }

  if (!data || !data.organizations) {
    return null
  }

  const domainRecord = data as OrganizationDomainWithOrg
  const org = normalizeOrganization(domainRecord.organizations)

  return { org, domainRecord }
}

async function findExistingMembership(
  db: DatabaseClient,
  orgId: string,
  userId: string
): Promise<OrganizationMember | null> {
  const { data } = await db
    .from("organization_members")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()

  return data
}

async function addMemberToOrganization(
  db: DatabaseClient,
  orgId: string,
  userId: string,
  role: "owner" | "member"
): Promise<OrganizationMember> {
  const { data, error } = await db
    .from("organization_members")
    .insert({
      org_id: orgId,
      user_id: userId,
      role,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error(`[FindOrCreateByDomain] Error adding ${role}:`, error)
    throw error
  }

  return data
}

async function createOrganization(
  db: DatabaseClient,
  name: string,
  slug: string,
  ownerId: string
): Promise<Organization> {
  const { data, error } = await db
    .from("organizations")
    .insert({
      name,
      slug,
      type: "team",
      owner_id: ownerId,
      settings: {},
    })
    .select()
    .single()

  if (error) {
    console.error("[FindOrCreateByDomain] Error creating organization:", error)
    throw error
  }

  return data
}

async function addDomainToOrganization(
  db: DatabaseClient,
  orgId: string,
  domain: string,
  userId: string
): Promise<void> {
  const { error } = await db.from("organization_domains").insert({
    org_id: orgId,
    domain: domain.toLowerCase(),
    is_primary: true,
    is_verified: true,
    created_by: userId,
    verified_by: userId,
    verified_at: new Date().toISOString(),
  })

  if (error) {
    console.error("[FindOrCreateByDomain] Error adding domain:", error)
    throw error
  }
}

async function deleteOrganization(db: DatabaseClient, orgId: string): Promise<void> {
  await db.from("organization_domains").delete().eq("org_id", orgId)
  await db.from("organizations").delete().eq("id", orgId)
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(req: Request) {
  try {
    // Authentication
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return Errors.rateLimited()
    }
    if (!authResult.user) {
      return Errors.unauthorized()
    }

    const user = authResult.user as AuthUser

    // Validate input
    const body = await req.json()
    const { email } = body

    if (!email) {
      return Errors.emailRequired()
    }

    const domain = extractDomain(email)
    if (!domain) {
      return Errors.invalidEmail()
    }

    if (isPublicEmailDomain(domain)) {
      return Errors.publicDomain()
    }

    const db = await createServiceDatabaseClient()

    // Try to find existing organization
    let orgResult: { org: Organization; domainRecord: OrganizationDomainWithOrg } | null

    try {
      orgResult = await findOrganizationByDomain(db, domain)
    } catch {
      return Errors.databaseError()
    }

    // Handle existing organization
    if (orgResult) {
      const { org } = orgResult

      const existingMember = await findExistingMembership(db, org.id, user.id)
      if (existingMember) {
        return NextResponse.json({
          organization: org,
          membership: existingMember,
          isNewMember: false,
        })
      }

      try {
        const newMember = await addMemberToOrganization(db, org.id, user.id, "member")
        return NextResponse.json({
          organization: org,
          membership: newMember,
          isNewMember: true,
        })
      } catch {
        return Errors.joinFailed()
      }
    }

    // Create new organization
    const orgName = generateOrgNameFromDomain(domain)
    const slug = generateSlug(domain)

    let newOrg: Organization

    try {
      newOrg = await createOrganization(db, orgName, slug, user.id)
    } catch {
      return Errors.createFailed()
    }

    // Add domain
    try {
      await addDomainToOrganization(db, newOrg.id, domain, user.id)
    } catch {
      await deleteOrganization(db, newOrg.id)
      return Errors.createFailed()
    }

    // Add owner as member
    let ownerMember: OrganizationMember

    try {
      ownerMember = await addMemberToOrganization(db, newOrg.id, user.id, "owner")
    } catch {
      await deleteOrganization(db, newOrg.id)
      return Errors.createFailed()
    }

    return NextResponse.json({
      organization: newOrg,
      membership: ownerMember,
      isNewOrg: true,
      isNewMember: true,
    })
  } catch (err) {
    console.error("[FindOrCreateByDomain] Unexpected error:", err)
    return Errors.internal()
  }
}

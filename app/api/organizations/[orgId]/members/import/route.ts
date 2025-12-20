import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// ============================================================================
// Types
// ============================================================================

interface MemberInput {
  email: string
  name?: string
}

interface RequestBody {
  members?: MemberInput[]
  emails?: string[]
}

interface ImportResults {
  preRegistered: string[]
  alreadyMember: string[]
  alreadyPreRegistered: string[]
  errors: { email: string; error: string }[]
}

interface ExistingUser {
  id: string
}

interface ExistingMember {
  id: string
}

interface ExistingInvite {
  id: string
  status: string
}

interface Membership {
  role: string
}

// ============================================================================
// Constants
// ============================================================================

const ADMIN_ROLES = ["owner", "admin"]
const DEFAULT_ROLE = "viewer"
const MAX_MEMBERS_PER_IMPORT = 100
const PRE_REGISTERED_STATUSES = ["pre_registered", "pending"]

const LOG_PREFIX = "[MembersImport]"

// ============================================================================
// Errors
// ============================================================================

const Errors = {
  rateLimit: () =>
    NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": "30" } }
    ),
  unauthorized: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  forbidden: () =>
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  noMembers: () =>
    NextResponse.json({ error: "No members provided" }, { status: 400 }),
  tooManyMembers: () =>
    NextResponse.json(
      { error: `Maximum ${MAX_MEMBERS_PER_IMPORT} members per import` },
      { status: 400 }
    ),
  internal: () =>
    NextResponse.json({ error: "Internal server error" }, { status: 500 }),
}

// ============================================================================
// Helpers
// ============================================================================

function createEmptyResults(): ImportResults {
  return {
    preRegistered: [],
    alreadyMember: [],
    alreadyPreRegistered: [],
    errors: [],
  }
}

function parseMembersFromBody(body: RequestBody): MemberInput[] {
  if (Array.isArray(body.members)) {
    return body.members
  }
  if (Array.isArray(body.emails)) {
    // Backwards compatibility: convert emails array to members array
    return body.emails.map((email: string) => ({ email }))
  }
  return []
}

function isValidEmail(email: string | undefined): email is string {
  return Boolean(email && email.includes("@"))
}

// ============================================================================
// Database Operations
// ============================================================================

async function getUserMembership(
  db: DatabaseClient,
  orgId: string,
  userId: string
): Promise<Membership | null> {
  const { data } = await db
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()

  return data as Membership | null
}

async function findUserByEmail(
  serviceDb: DatabaseClient,
  email: string
): Promise<ExistingUser | null> {
  const { data } = await serviceDb
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  return data as ExistingUser | null
}

async function findExistingMember(
  serviceDb: DatabaseClient,
  orgId: string,
  userId: string
): Promise<ExistingMember | null> {
  const { data } = await serviceDb
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()

  return data as ExistingMember | null
}

async function addMemberToOrganization(
  serviceDb: DatabaseClient,
  orgId: string,
  userId: string,
  invitedBy: string
): Promise<{ error: Error | null }> {
  const { error } = await serviceDb
    .from("organization_members")
    .insert({
      org_id: orgId,
      user_id: userId,
      role: DEFAULT_ROLE,
      status: "active",
      invited_by: invitedBy,
      joined_at: new Date().toISOString(),
    })

  return { error }
}

async function findExistingPreRegistration(
  serviceDb: DatabaseClient,
  orgId: string,
  email: string
): Promise<ExistingInvite | null> {
  const { data } = await serviceDb
    .from("organization_invites")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("email", email)
    .in("status", PRE_REGISTERED_STATUSES)
    .maybeSingle()

  return data as ExistingInvite | null
}

async function createPreRegistration(
  serviceDb: DatabaseClient,
  orgId: string,
  email: string,
  invitedBy: string
): Promise<{ error: Error | null }> {
  const { error } = await serviceDb
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email,
      role: DEFAULT_ROLE,
      invited_by: invitedBy,
      status: "pre_registered",
      invited_at: new Date().toISOString(),
      expires_at: null,
      token: null,
    })

  return { error }
}

// ============================================================================
// Member Processing
// ============================================================================

async function processMember(
  serviceDb: DatabaseClient,
  orgId: string,
  invitedBy: string,
  member: MemberInput,
  results: ImportResults
): Promise<void> {
  const email = member.email?.trim().toLowerCase()

  if (!isValidEmail(email)) {
    results.errors.push({ email: email || "empty", error: "Invalid email" })
    return
  }

  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(serviceDb, email)

    if (existingUser) {
      // Check if already a member
      const existingMember = await findExistingMember(serviceDb, orgId, existingUser.id)

      if (existingMember) {
        results.alreadyMember.push(email)
        return
      }

      // User exists but not a member - add them directly
      const { error: memberError } = await addMemberToOrganization(
        serviceDb,
        orgId,
        existingUser.id,
        invitedBy
      )

      if (memberError) {
        console.error(`${LOG_PREFIX} Failed to add member:`, memberError)
        results.errors.push({ email, error: "Failed to add member" })
      } else {
        results.preRegistered.push(email)
      }
      return
    }

    // Check if already pre-registered
    const existingPreReg = await findExistingPreRegistration(serviceDb, orgId, email)

    if (existingPreReg) {
      results.alreadyPreRegistered.push(email)
      return
    }

    // Create pre-registration
    const { error: inviteError } = await createPreRegistration(serviceDb, orgId, email, invitedBy)

    if (inviteError) {
      console.error(`${LOG_PREFIX} Failed to pre-register:`, inviteError)
      results.errors.push({ email, error: "Failed to pre-register" })
      return
    }

    results.preRegistered.push(email)
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error for email:`, email, err)
    results.errors.push({ email, error: "Unexpected error" })
  }
}

function buildSuccessResponse(results: ImportResults) {
  return NextResponse.json({
    success: results.preRegistered.length,
    failed: results.errors.length,
    alreadyMember: results.alreadyMember.length,
    alreadyPreRegistered: results.alreadyPreRegistered.length,
    details: {
      preRegistered: results.preRegistered,
      alreadyMember: results.alreadyMember,
      alreadyPreRegistered: results.alreadyPreRegistered,
      errors: results.errors,
    },
  })
}

// ============================================================================
// Route Handler
// ============================================================================

// POST /api/organizations/[orgId]/members/import - Import/pre-register members from CSV
export async function POST(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return Errors.rateLimit()
    }

    if (!authResult.user) {
      return Errors.unauthorized()
    }

    const user = authResult.user
    const { orgId } = params

    // Verify user is admin/owner
    const membership = await getUserMembership(db, orgId, user.id)

    if (!membership || !ADMIN_ROLES.includes(membership.role)) {
      return Errors.forbidden()
    }

    // Parse request body
    const body: RequestBody = await request.json()
    const members = parseMembersFromBody(body)

    if (members.length === 0) {
      return Errors.noMembers()
    }

    if (members.length > MAX_MEMBERS_PER_IMPORT) {
      return Errors.tooManyMembers()
    }

    // Process all members
    const results = createEmptyResults()

    for (const member of members) {
      await processMember(serviceDb, orgId, user.id, member, results)
    }

    return buildSuccessResponse(results)
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error in POST:`, err)
    return Errors.internal()
  }
}

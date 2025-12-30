import { NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// ============================================================================
// Types
// ============================================================================

interface AuthUser {
  id: string
  email?: string
}

interface Membership {
  role: string
}

interface Organization {
  id: string
  name: string
  type: string
  settings?: Record<string, unknown>
  ai_sessions_per_day?: number
  require_preregistration?: boolean
  max_failed_attempts?: number
  lockout_duration_minutes?: number
  updated_at?: string
}

interface UpdateOrgBody {
  name?: string
  settings?: Record<string, unknown>
  ai_sessions_per_day?: number
  require_preregistration?: boolean
  max_failed_attempts?: number
  lockout_duration_minutes?: number
}

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[Organizations]"
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ADMIN_ROLES = ["owner", "admin"]

// Validation limits
const AI_SESSIONS_MIN = 0
const AI_SESSIONS_MAX = 100
const MAX_FAILED_ATTEMPTS_MIN = 1
const MAX_FAILED_ATTEMPTS_MAX = 20
const LOCKOUT_DURATION_MIN = 1
const LOCKOUT_DURATION_MAX = 1440

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  invalidOrgId: () =>
    NextResponse.json({ error: "Invalid organization ID" }, { status: 400 }),
  rateLimit: () =>
    NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": "30" } }
    ),
  unauthorized: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  notMember: () =>
    NextResponse.json({ error: "Not a member of this organization" }, { status: 403 }),
  notAdminOrOwner: () =>
    NextResponse.json({ error: "Only owners and admins can update organization" }, { status: 403 }),
  notOwner: () =>
    NextResponse.json({ error: "Only owners can delete organization" }, { status: 403 }),
  notFound: () =>
    NextResponse.json({ error: "Organization not found" }, { status: 404 }),
  cannotDeletePersonal: () =>
    NextResponse.json({ error: "Cannot delete personal organization" }, { status: 400 }),
  updateFailed: () =>
    NextResponse.json({ error: "Failed to update organization" }, { status: 500 }),
  deleteFailed: () =>
    NextResponse.json({ error: "Failed to delete organization" }, { status: 500 }),
  internal: () =>
    NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Helpers
// ============================================================================

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function buildUpdatePayload(body: UpdateOrgBody): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name && typeof body.name === "string") {
    updates.name = body.name.trim()
  }

  if (body.settings && typeof body.settings === "object") {
    updates.settings = body.settings
  }

  if (
    typeof body.ai_sessions_per_day === "number" &&
    isInRange(body.ai_sessions_per_day, AI_SESSIONS_MIN, AI_SESSIONS_MAX)
  ) {
    updates.ai_sessions_per_day = body.ai_sessions_per_day
  }

  if (typeof body.require_preregistration === "boolean") {
    updates.require_preregistration = body.require_preregistration
  }

  if (
    typeof body.max_failed_attempts === "number" &&
    isInRange(body.max_failed_attempts, MAX_FAILED_ATTEMPTS_MIN, MAX_FAILED_ATTEMPTS_MAX)
  ) {
    updates.max_failed_attempts = body.max_failed_attempts
  }

  if (
    typeof body.lockout_duration_minutes === "number" &&
    isInRange(body.lockout_duration_minutes, LOCKOUT_DURATION_MIN, LOCKOUT_DURATION_MAX)
  ) {
    updates.lockout_duration_minutes = body.lockout_duration_minutes
  }

  return updates
}

// ============================================================================
// Auth Helpers
// ============================================================================

interface AuthResult {
  success: true
  user: AuthUser
}

interface AuthError {
  success: false
  response: NextResponse
}

async function getAuthenticatedUser(): Promise<AuthResult | AuthError> {
  const authResult = await getCachedAuthUser()

  if (authResult.rateLimited) {
    return { success: false, response: Errors.rateLimit() }
  }

  if (!authResult.user) {
    return { success: false, response: Errors.unauthorized() }
  }

  return { success: true, user: authResult.user }
}

// ============================================================================
// Database Operations
// ============================================================================

async function getMembership(
  db: DatabaseClient,
  orgId: string,
  userId: string
): Promise<Membership | null> {
  const { data, error } = await db
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) return null
  return data as Membership
}

async function getOrganization(
  db: DatabaseClient,
  orgId: string
): Promise<Organization | null> {
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle()

  if (error || !data) return null
  return data as Organization
}

async function getOrganizationType(
  db: DatabaseClient,
  orgId: string
): Promise<{ type: string } | null> {
  const { data, error } = await db
    .from("organizations")
    .select("type")
    .eq("id", orgId)
    .maybeSingle()

  if (error || !data) return null
  return data as { type: string }
}

async function updateOrganization(
  db: DatabaseClient,
  orgId: string,
  updates: Record<string, unknown>
): Promise<{ data: Organization | null; error: Error | null }> {
  const { data, error } = await db
    .from("organizations")
    .update(updates)
    .eq("id", orgId)
    .select()
    .maybeSingle()

  return { data: data as Organization | null, error }
}

async function deleteOrganization(
  db: DatabaseClient,
  orgId: string
): Promise<{ error: Error | null }> {
  const { error } = await db
    .from("organizations")
    .delete()
    .eq("id", orgId)

  return { error }
}

// ============================================================================
// Route Handlers
// ============================================================================

// GET /api/organizations/[orgId] - Get organization details
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    if (!isValidUUID(orgId)) {
      return Errors.invalidOrgId()
    }

    const authResult = await getAuthenticatedUser()
    if (!authResult.success) {
      return authResult.response
    }

    const db = await createServiceDatabaseClient()

    // Check membership
    const membership = await getMembership(db, orgId, authResult.user.id)
    if (!membership) {
      return Errors.notMember()
    }

    // Get organization
    const org = await getOrganization(db, orgId)
    if (!org) {
      return Errors.notFound()
    }

    return NextResponse.json({ organization: org, role: membership.role })
  } catch (err) {
    console.error(`${LOG_PREFIX} GET error:`, err)
    return Errors.internal()
  }
}

// PATCH /api/organizations/[orgId] - Update organization
export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    if (!isValidUUID(orgId)) {
      return Errors.invalidOrgId()
    }

    const authResult = await getAuthenticatedUser()
    if (!authResult.success) {
      return authResult.response
    }

    const db = await createServiceDatabaseClient()

    // Check admin/owner role
    const membership = await getMembership(db, orgId, authResult.user.id)
    if (!membership) {
      return Errors.notMember()
    }

    if (!ADMIN_ROLES.includes(membership.role)) {
      return Errors.notAdminOrOwner()
    }

    const body: UpdateOrgBody = await req.json()
    const updates = buildUpdatePayload(body)

    const { data: updated, error: updateError } = await updateOrganization(db, orgId, updates)

    if (updateError) {
      console.error(`${LOG_PREFIX} Error updating organization:`, updateError)
      return Errors.updateFailed()
    }

    return NextResponse.json({ organization: updated })
  } catch (err) {
    console.error(`${LOG_PREFIX} PATCH error:`, err)
    return Errors.internal()
  }
}

// DELETE /api/organizations/[orgId] - Delete organization
export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    if (!isValidUUID(orgId)) {
      return Errors.invalidOrgId()
    }

    const authResult = await getAuthenticatedUser()
    if (!authResult.success) {
      return authResult.response
    }

    const db = await createServiceDatabaseClient()

    // Check owner role
    const membership = await getMembership(db, orgId, authResult.user.id)
    if (!membership) {
      return Errors.notMember()
    }

    if (membership.role !== "owner") {
      return Errors.notOwner()
    }

    // Check if it's a personal org
    const org = await getOrganizationType(db, orgId)
    if (!org) {
      return Errors.notFound()
    }

    if (org.type === "personal") {
      return Errors.cannotDeletePersonal()
    }

    // Delete organization (cascade will handle members)
    const { error: deleteError } = await deleteOrganization(db, orgId)

    if (deleteError) {
      console.error(`${LOG_PREFIX} Error deleting organization:`, deleteError)
      return Errors.deleteFailed()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`${LOG_PREFIX} DELETE error:`, err)
    return Errors.internal()
  }
}

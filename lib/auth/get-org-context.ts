import { db as pgClient } from "@/lib/database/pg-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { cookies } from "next/headers"

// Types
export interface OrgContext {
  userId: string
  orgId: string
  role: OrgRole
  isPersonalOrg: boolean
}

export interface OrgContextError {
  type: "rate_limit" | "auth_error" | "unknown"
  message: string
}

type OrgRole = "owner" | "admin" | "member" | "viewer"

interface OrgMembership {
  org_id: string
  role: string
  organizations: { id: string; type: string } | null
}

// Constants
const CURRENT_ORG_COOKIE = "current_org_id"
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

// Helper functions
function isRateLimitError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) {
    return error.message.includes("Too Many") || error.message.includes("429")
  }
  if (typeof error === "string") {
    return error.includes("Too Many") || error.includes("429")
  }
  return false
}

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function getOrgFromMembership(membership: OrgMembership): { id: string; type: string } | null {
  return membership.organizations as { id: string; type: string } | null
}

function buildOrgContext(userId: string, membership: OrgMembership): OrgContext {
  const org = getOrgFromMembership(membership)
  return {
    userId,
    orgId: membership.org_id,
    role: membership.role as OrgRole,
    isPersonalOrg: org?.type === "personal",
  }
}

function findMembershipByOrgId(memberships: OrgMembership[], orgId: string): OrgMembership | undefined {
  return memberships.find((m) => m.org_id === orgId)
}

function findPersonalMembership(memberships: OrgMembership[]): OrgMembership | undefined {
  return memberships.find((m) => {
    const org = getOrgFromMembership(m)
    return org?.type === "personal"
  })
}

function selectBestMembership(memberships: OrgMembership[]): OrgMembership {
  // Prefer personal org, then first available
  return findPersonalMembership(memberships) || memberships[0]
}

async function fetchUserMemberships(
  userId: string,
): Promise<OrgMembership[] | null> {
  try {
    const result = await pgClient.query(
      `SELECT 
        m.org_id,
        m.role,
        json_build_object('id', o.id, 'type', o.type) as organizations
       FROM organization_members m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1`,
      [userId]
    )
    return result.rows as OrgMembership[]
  } catch (error) {
    if (isRateLimitError(error)) {
      console.error("[SERVER] getOrgContext: Rate limited during membership fetch")
      throw new Error("RATE_LIMITED")
    }
    console.error("getOrgContext: Error fetching memberships:", error)
    return null
  }
}

/**
 * Get the user's currently selected org_id from cookie or default to personal org
 */
export async function getCurrentOrgId(): Promise<string | undefined> {
  const cookieStore = cookies()
  return cookieStore.get(CURRENT_ORG_COOKIE)?.value ?? undefined
}

/**
 * Get organization context for API routes
 * Validates user authentication and organization membership
 * Returns null if user is not authenticated or not a member of the org
 */
export async function getOrgContext(requestedOrgId?: string): Promise<OrgContext | null> {
  try {
    // Authenticate user
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      console.error("[SERVER] getOrgContext: Rate limited during auth")
      throw new Error("RATE_LIMITED")
    }

    if (!authResult.user) {
      return null
    }

    const userId = authResult.user.id

    // Determine target org
    let targetOrgId = requestedOrgId || (await getCurrentOrgId())
    if (targetOrgId && !isValidUuid(targetOrgId)) {
      targetOrgId = undefined
    }

    // Fetch user's memberships
    const memberships = await fetchUserMemberships(userId)
    
    // If no memberships, return a fallback personal context
    // This handles users who signed up before org system was in place
    if (!memberships?.length) {
      console.log("[SERVER] getOrgContext: No memberships found for user, returning fallback context")
      return {
        userId,
        orgId: userId, // Use userId as a pseudo-org for personal context
        role: "owner" as OrgRole,
        isPersonalOrg: true,
      }
    }

    // If target org specified, try to use it
    if (targetOrgId) {
      const targetMembership = findMembershipByOrgId(memberships, targetOrgId)
      if (targetMembership) {
        return buildOrgContext(userId, targetMembership)
      }
    }

    // Fall back to best available membership
    const selectedMembership = selectBestMembership(memberships)
    return buildOrgContext(userId, selectedMembership)
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      throw err
    }
    console.error("getOrgContext: Unexpected error", err)
    return null
  }
}

/**
 * Require organization context - throws error if not authenticated
 */
export async function requireOrgContext(requestedOrgId?: string): Promise<OrgContext> {
  const context = await getOrgContext(requestedOrgId)

  if (!context) {
    throw new Error("Unauthorized: Must be authenticated and a member of the organization")
  }

  return context
}

/**
 * Check if user has at least the specified role in the organization
 */
export function hasMinRole(currentRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole]
}

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export interface OrgContext {
  userId: string
  orgId: string
  role: "owner" | "admin" | "member" | "viewer"
  isPersonalOrg: boolean
}

export interface OrgContextError {
  type: "rate_limit" | "auth_error" | "unknown"
  message: string
}

const CURRENT_ORG_COOKIE = "current_org_id"

interface CacheEntry {
  userId: string
  timestamp: number
}

const authCache = new Map<string, CacheEntry>()
const CACHE_TTL = 30000 // 30 seconds cache TTL
const MAX_CACHE_SIZE = 1000

function getCacheKey(cookieHeader: string | null): string {
  // Use a hash of relevant auth cookies as cache key
  return cookieHeader ? `auth:${cookieHeader.slice(0, 100)}` : "auth:anonymous"
}

function cleanupCache() {
  const now = Date.now()
  if (authCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries if cache is too large
    const entries = Array.from(authCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2))
    toRemove.forEach(([key]) => authCache.delete(key))
  }
  // Remove expired entries
  for (const [key, entry] of authCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      authCache.delete(key)
    }
  }
}

/**
 * Get the user's currently selected org_id from cookie or default to personal org
 */
export async function getCurrentOrgId(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CURRENT_ORG_COOKIE)?.value ?? undefined
}

/**
 * Get organization context for API routes
 * Validates user authentication and organization membership
 * Returns null if user is not authenticated or not a member of the org
 */
export async function getOrgContext(requestedOrgId?: string): Promise<OrgContext | null> {
  try {
    const cookieStore = await cookies()
    const cacheKey = getCacheKey(cookieStore.toString())

    const cached = authCache.get(cacheKey)
    const now = Date.now()

    let userId: string

    if (cached && now - cached.timestamp < CACHE_TTL) {
      // Use cached user ID
      userId = cached.userId
    } else {
      // Cache miss or expired - fetch from Supabase
      const supabase = await createClient()

      let authResult
      try {
        authResult = await supabase.auth.getUser()
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
        if (errorMessage.includes("Too Many") || errorMessage.includes("429")) {
          console.error("[SERVER] getOrgContext: Rate limited during auth")
          throw new Error("RATE_LIMITED")
        }
        console.error("getOrgContext: Fetch error during auth:", errorMessage)
        return null
      }

      const {
        data: { user },
        error: authError,
      } = authResult

      if (authError) {
        const errorMessage = authError.message || String(authError)
        if (errorMessage.includes("Too Many") || errorMessage.includes("429")) {
          console.error("[SERVER] getOrgContext: Rate limited")
          throw new Error("RATE_LIMITED")
        }
        return null
      }

      if (!user) {
        return null
      }

      userId = user.id

      cleanupCache()
      authCache.set(cacheKey, { userId, timestamp: now })
    }

    const serviceClient = createServiceClient()

    let targetOrgId = requestedOrgId
    if (!targetOrgId) {
      targetOrgId = await getCurrentOrgId()
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (targetOrgId && !uuidRegex.test(targetOrgId)) {
      targetOrgId = undefined
    }

    const { data: allMemberships, error: allMemberError } = await serviceClient
      .from("organization_members")
      .select(`
        org_id,
        role,
        organizations!organization_members_org_id_fkey (
          id,
          type
        )
      `)
      .eq("user_id", userId)

    if (allMemberError) {
      const errorMessage = allMemberError.message || String(allMemberError)
      if (errorMessage.includes("Too Many") || errorMessage.includes("429")) {
        console.error("[SERVER] getOrgContext: Rate limited during membership fetch")
        throw new Error("RATE_LIMITED")
      }
      console.error("getOrgContext: Error fetching memberships:", allMemberError)
      return null
    }

    if (!allMemberships || allMemberships.length === 0) {
      return null
    }

    // If we have a target org, check if user is a member
    if (targetOrgId) {
      const membership = allMemberships.find((m) => m.org_id === targetOrgId)

      if (membership) {
        const org = membership.organizations as unknown as { id: string; type: string }
        return {
          userId,
          orgId: membership.org_id,
          role: membership.role as OrgContext["role"],
          isPersonalOrg: org?.type === "personal",
        }
      }
    }

    // Prefer personal org, then team org
    const personalMembership = allMemberships.find((m) => {
      const org = m.organizations as unknown as { id: string; type: string }
      return org?.type === "personal"
    })

    const selectedMembership = personalMembership || allMemberships[0]
    const org = selectedMembership.organizations as unknown as { id: string; type: string }

    return {
      userId,
      orgId: selectedMembership.org_id,
      role: selectedMembership.role as OrgContext["role"],
      isPersonalOrg: org?.type === "personal",
    }
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      throw err
    }
    console.error("getOrgContext: Unexpected error", err)
    return null
  }
}

/**
 * Require organization context - returns error response if not authenticated
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
export function hasMinRole(currentRole: OrgContext["role"], requiredRole: OrgContext["role"]): boolean {
  const roleHierarchy: Record<OrgContext["role"], number> = {
    viewer: 0,
    member: 1,
    admin: 2,
    owner: 3,
  }

  return roleHierarchy[currentRole] >= roleHierarchy[requiredRole]
}

// Stick Chats handler - shared auth helpers extracted from stick-chats routes
// These routes only have v1, but share auth boilerplate internally.
import { type NextResponse } from 'next/server'
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'

// ============================================================================
// Types
// ============================================================================

export interface OrgContextResult {
  orgId: string
  organizationId?: string
}

interface RateLimitedResult {
  rateLimited: true
}

export interface AuthResult {
  user: { id: string; email?: string }
  orgContext: OrgContextResult | null
}

// ============================================================================
// Auth Helpers
// ============================================================================

function isRateLimited(result: OrgContextResult | RateLimitedResult | null): result is RateLimitedResult {
  return result !== null && 'rateLimited' in result
}

async function safeGetOrgContext(userId: string): Promise<OrgContextResult | RateLimitedResult | null> {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return { rateLimited: true }
    }
    throw error
  }
}

export function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === 'RATE_LIMITED') {
    return createRateLimitResponse()
  }
  return null
}

/**
 * Authenticate user and get org context. Returns null if auth fails
 * (in which case the appropriate response was already constructed and returned
 * through the `onFail` callback).
 */
export async function authenticateWithOrg(): Promise<
  | { ok: true; user: { id: string; email?: string }; orgContext: OrgContextResult | null }
  | { ok: false; response: Response }
> {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === 'rate_limited') {
    return { ok: false, response: createRateLimitResponse() }
  }

  if (!user) {
    return { ok: false, response: createUnauthorizedResponse() }
  }

  const orgContextResult = await safeGetOrgContext(user.id)
  if (isRateLimited(orgContextResult)) {
    return { ok: false, response: createRateLimitResponse() }
  }

  return { ok: true, user, orgContext: orgContextResult }
}

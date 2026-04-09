import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"

/**
 * Authenticate user only (no org context).
 * Returns { user } on success, or { response } on failure.
 *
 * Use this for routes that don't need organization context.
 */
export async function requireAuth() {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { response: createRateLimitResponse() }
  if (!user) return { response: createUnauthorizedResponse() }

  return { user }
}

/**
 * Authenticate user and resolve org context in one call.
 * Returns { user, orgContext } on success, or { response } on failure.
 *
 * Eliminates ~8 lines of repeated auth/org boilerplate per handler.
 */
export async function requireAuthAndOrg() {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { response: createRateLimitResponse() }
  if (!user) return { response: createUnauthorizedResponse() }

  const orgContext = await getOrgContext()
  if (!orgContext) return { response: NextResponse.json({ error: "No organization context" }, { status: 403 }) }

  return { user, orgContext }
}

/**
 * Fail-open rate limiter — returns true if allowed (or if rate limiter throws).
 * Safe to call from any route without worrying about errors blocking requests.
 */
export async function safeRateLimit(request: NextRequest, userId: string, action: string): Promise<boolean> {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch {
    return true
  }
}

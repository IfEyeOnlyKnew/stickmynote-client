// 2FA Enforcement Middleware
// Checks if user complies with organization 2FA policy

import "server-only"
import { checkUserCompliance } from "@/lib/auth/2fa-policy"

export interface EnforcementResult {
  allowed: boolean
  reason?: string
  requiresSetup?: boolean
}

/**
 * Check if user can access the application based on 2FA policy
 * Returns enforcement result with details
 */
export async function enforce2FAPolicy(
  userId: string,
  orgId: string,
  path: string
): Promise<EnforcementResult> {
  // Always allow access to 2FA setup pages
  const allowedPaths = [
    "/settings/security",
    "/api/auth/2fa/setup",
    "/api/auth/2fa/verify-setup",
    "/api/auth/2fa/status",
    "/api/auth/signout",
  ]

  if (allowedPaths.some((p) => path.startsWith(p))) {
    return { allowed: true }
  }

  // Check compliance
  const compliance = await checkUserCompliance(userId, orgId)

  // User is compliant - allow access
  if (compliance.compliant) {
    return { allowed: true }
  }

  // User is not compliant - block access
  return {
    allowed: false,
    reason: compliance.reason || "Two-factor authentication is required",
    requiresSetup: true,
  }
}

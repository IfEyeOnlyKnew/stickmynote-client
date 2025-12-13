import { type NextRequest, NextResponse } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"

/**
 * CSRF protection wrapper for API route handlers
 * Validates CSRF token before executing the handler
 *
 * Usage:
 * export const POST = withCSRFProtection(async (request) => {
 *   // Your handler logic
 * })
 */
export function withCSRFProtection<T extends NextRequest>(
  handler: (request: T, context?: any) => Promise<NextResponse>,
) {
  return async (request: T, context?: any): Promise<NextResponse> => {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      console.warn("[CSRF] Request blocked - invalid or missing CSRF token", {
        url: request.url,
        method: request.method,
      })
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }
    return handler(request, context)
  }
}

/**
 * Optional CSRF protection - logs warning but doesn't block
 * Use for gradual rollout or non-critical endpoints
 */
export function withCSRFWarning<T extends NextRequest>(handler: (request: T, context?: any) => Promise<NextResponse>) {
  return async (request: T, context?: any): Promise<NextResponse> => {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      console.warn("[CSRF] Warning - request without valid CSRF token", {
        url: request.url,
        method: request.method,
      })
    }
    return handler(request, context)
  }
}

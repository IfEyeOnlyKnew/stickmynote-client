/**
 * Extract IP address and user-agent from an incoming request.
 */
export function getRequestContext(request: Request): {
  ipAddress: string | null
  userAgent: string | null
} {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent") || null,
  }
}

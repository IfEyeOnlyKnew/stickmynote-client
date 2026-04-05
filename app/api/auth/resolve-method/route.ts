import { type NextRequest, NextResponse } from "next/server"
import { resolveAuthMethod } from "@/lib/auth/sso-resolver"

export const dynamic = "force-dynamic"

/**
 * GET /api/auth/resolve-method?email=user@company.com
 *
 * Public endpoint — returns the auth method for an email address.
 * Never exposes internal IdP details to the client.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")

  if (!email?.includes("@")) {
    return NextResponse.json({ method: "ldap" })
  }

  const resolution = await resolveAuthMethod(email)

  return NextResponse.json({
    method: resolution.method === "ldap" ? "ldap" : "sso",
    enforceOnly: resolution.enforceOnly ?? false,
  })
}

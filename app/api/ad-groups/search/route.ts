import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { searchADGroups } from "@/lib/auth/ldap-auth"

/**
 * AD GROUP SEARCH API
 *
 * Search for Active Directory groups by name.
 * Used for inviting all members of a group to a social pad.
 */

/**
 * GET /api/ad-groups/search
 * Search for AD groups by name
 * Query params:
 *   - query: search string (required, min 2 chars)
 *   - limit: max results (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query")?.trim() || ""
    const limitParam = searchParams.get("limit")
    const limit = Math.min(Number.parseInt(limitParam || "10", 10), 50)

    // Require at least 2 characters to search
    if (query.length < 2) {
      return NextResponse.json({ groups: [] })
    }

    const result = await searchADGroups(query, limit)

    if (!result.success) {
      console.error("[ADGroupSearch] Search error:", result.error)
      return NextResponse.json({ groups: [], error: result.error }, { status: 500 })
    }

    return NextResponse.json({ groups: result.groups || [] })
  } catch (error) {
    console.error("[ADGroupSearch] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

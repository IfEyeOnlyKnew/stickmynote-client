import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import { searchLDAPUsers } from "@/lib/auth/ldap-auth"

/**
 * USER SEARCH API
 *
 * Search for users in Active Directory (LDAP) and/or local database.
 * Used for inviting members to chats, pads, etc.
 */

interface SearchedUser {
  id: string | null
  username: string | null
  email: string | null
  full_name: string | null
  source: "ldap" | "database"
  dn?: string
}

// Handle rate limit errors
function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

/**
 * GET /api/user-search
 * Search for users by name, username, or email
 * Query params:
 *   - query: search string (required, min 2 chars)
 *   - limit: max results (default 10, max 50)
 *   - source: "ldap" | "database" | "both" (default: "ldap")
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
    const limit = Math.min(parseInt(limitParam || "10", 10), 50)
    const source = searchParams.get("source") || "ldap"

    // Require at least 2 characters to search
    if (query.length < 2) {
      return NextResponse.json([])
    }

    const results: SearchedUser[] = []
    const seenEmails = new Set<string>()

    // Search LDAP (Active Directory)
    if (source === "ldap" || source === "both") {
      try {
        const ldapResult = await searchLDAPUsers(query, limit)
        
        if (ldapResult.success && ldapResult.users) {
          for (const ldapUser of ldapResult.users) {
            const email = ldapUser.email?.toLowerCase()
            if (email && !seenEmails.has(email) && email !== user.email?.toLowerCase()) {
              seenEmails.add(email)
              
              // Check if this LDAP user already exists in our database
              const existingUser = await db.query(
                `SELECT id FROM users WHERE email = $1 OR distinguished_name = $2 LIMIT 1`,
                [ldapUser.email, ldapUser.dn]
              )
              
              results.push({
                id: existingUser.rows[0]?.id || null,
                username: ldapUser.sAMAccountName,
                email: ldapUser.email,
                full_name: ldapUser.displayName || `${ldapUser.givenName} ${ldapUser.surname}`.trim(),
                source: "ldap",
                dn: ldapUser.dn,
              })
            }
          }
        }
      } catch (ldapError) {
        console.error("[UserSearch] LDAP search error:", ldapError)
        // Continue with database search if LDAP fails
      }
    }

    // Search local database (for users who have already logged in)
    if (source === "database" || source === "both" || results.length === 0) {
      const searchPattern = `%${query}%`
      
      const dbResult = await db.query<{ id: string; username: string | null; email: string; full_name: string | null }>(
        `SELECT id, username, email, full_name
         FROM users
         WHERE id != $1
           AND (
             full_name ILIKE $2
             OR username ILIKE $2
             OR email ILIKE $2
           )
         ORDER BY full_name ASC
         LIMIT $3`,
        [user.id, searchPattern, limit]
      )

      for (const dbUser of dbResult.rows) {
        const email = dbUser.email?.toLowerCase()
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email)
          results.push({
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            full_name: dbUser.full_name,
            source: "database",
          })
        }
      }
    }

    return NextResponse.json(results.slice(0, limit))
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[UserSearch] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

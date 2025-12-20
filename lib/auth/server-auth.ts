/**
 * Server-side authentication helper
 * Provides a unified interface for authentication using local PostgreSQL and JWT
 */

import { NextResponse } from "next/server"
import { getSession, getUserById, type User, type Session } from "./local-auth"

export interface AuthResult {
  user: User | null
  session: Session | null
  error: string | null
}

/**
 * Get the current authenticated user from session
 * Use this in API routes and server components
 * 
 * @returns AuthResult with user, session, and error
 * 
 * @example
 * ```typescript
 * const { user, error } = await getAuthUser()
 * if (!user) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
 * }
 * ```
 */
export async function getAuthUser(): Promise<AuthResult> {
  try {
    const session = await getSession()
    
    if (!session) {
      return {
        user: null,
        session: null,
        error: "Not authenticated",
      }
    }

    return {
      user: session.user,
      session,
      error: null,
    }
  } catch (error) {
    console.error("[ServerAuth] Error getting auth user:", error)
    return {
      user: null,
      session: null,
      error: "Authentication failed",
    }
  }
}

/**
 * Require authentication in an API route
 * Returns user if authenticated, or returns an error response
 * 
 * @returns Object with user and optional error response
 * 
 * @example
 * ```typescript
 * const { user, errorResponse } = await requireAuth()
 * if (errorResponse) return errorResponse
 * 
 * // user is guaranteed to be non-null here
 * ```
 */
export async function requireAuth(): Promise<{
  user: User | null
  errorResponse?: NextResponse
}> {
  const { user } = await getAuthUser()

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    }
  }

  return { user }
}

/**
 * Check if user has permission to access a resource
 * 
 * @param userId - The authenticated user's ID
 * @param resourceOwnerId - The owner ID of the resource
 * @returns boolean indicating if user has permission
 */
export function hasPermission(userId: string, resourceOwnerId: string): boolean {
  return userId === resourceOwnerId
}

/**
 * Require that the authenticated user owns a resource
 * Returns error response if user doesn't own the resource
 * 
 * @param userId - The authenticated user's ID  
 * @param resourceOwnerId - The owner ID of the resource
 * @param resourceType - Type of resource (for error message)
 * @returns Object with authorized flag and optional error response
 */
export function requireOwnership(
  userId: string,
  resourceOwnerId: string,
  resourceType = "resource"
): {
  authorized: boolean
  errorResponse?: NextResponse
} {
  if (!hasPermission(userId, resourceOwnerId)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: `You don't have permission to access this ${resourceType}` },
        { status: 403 }
      ),
    }
  }

  return { authorized: true }
}

/**
 * Get user by ID (useful for admin operations)
 */
export async function getUserByIdAuth(userId: string): Promise<User | null> {
  return getUserById(userId)
}

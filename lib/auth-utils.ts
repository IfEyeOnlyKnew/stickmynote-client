import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

export interface AuthResult {
  user: User | null
  error: string | null
  response?: NextResponse
}

/**
 * Server-side authentication utility for API routes
 * Returns user if authenticated, or an error response
 */
export async function requireAuth(request?: NextRequest): Promise<AuthResult> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        user: null,
        error: "Unauthorized",
        response: NextResponse.json({ error: "Unauthorized - Please sign in" }, { status: 401 }),
      }
    }

    return { user, error: null }
  } catch (error) {
    console.error("[Auth] Error in requireAuth:", error)
    return {
      user: null,
      error: "Authentication failed",
      response: NextResponse.json({ error: "Authentication failed" }, { status: 500 }),
    }
  }
}

/**
 * Check if user has permission to access a resource
 * @param userId - The authenticated user's ID
 * @param resourceOwnerId - The owner ID of the resource
 * @param allowedRoles - Optional array of allowed roles (for future role-based access)
 */
export function hasPermission(userId: string, resourceOwnerId: string, allowedRoles?: string[]): boolean {
  // Basic ownership check
  if (userId === resourceOwnerId) {
    return true
  }

  // Future: Add role-based checks here
  // if (allowedRoles && userRole && allowedRoles.includes(userRole)) {
  //   return true
  // }

  return false
}

/**
 * Verify user owns a resource or return error response
 */
export async function requireOwnership(
  userId: string,
  resourceOwnerId: string,
  resourceType = "resource",
): Promise<{ authorized: boolean; response?: NextResponse }> {
  if (!hasPermission(userId, resourceOwnerId)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `Forbidden - You don't have permission to access this ${resourceType}` },
        { status: 403 },
      ),
    }
  }

  return { authorized: true }
}

/**
 * Check if user is admin (for future admin features)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  // Future: Query user roles from database
  // const supabase = await createServerClient()
  // const { data } = await supabase
  //   .from('user_roles')
  //   .select('role')
  //   .eq('user_id', userId)
  //   .single()
  // return data?.role === 'admin'

  return false // Placeholder
}

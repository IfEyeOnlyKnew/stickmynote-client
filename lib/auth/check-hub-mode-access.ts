import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

/**
 * Server-side function to check if user has full_access hub_mode
 * Redirects to /personal if user has personal_only hub_mode
 * Call this at the top of server components that require full_access
 */
export async function requireFullAccess() {
  const session = await getSession()

  if (!session) {
    redirect("/auth/login")
  }

  const user = session.user

  // Fetch user profile to check hub_mode
  const result = await db.query(
    `SELECT hub_mode FROM users WHERE id = $1`,
    [user.id]
  )

  if (result.rows.length === 0) {
    console.error("[v0] requireFullAccess - Error fetching profile: user not found")
    // Default to allowing access if there's an error fetching profile
    return user
  }

  const hubMode = result.rows[0]?.hub_mode || "personal_only"

  console.log("[v0] requireFullAccess - user:", user.email, "hubMode:", hubMode)

  if (hubMode === "personal_only") {
    console.log("[v0] requireFullAccess - BLOCKING personal_only user, redirecting to /personal")
    redirect("/personal")
  }

  return user
}

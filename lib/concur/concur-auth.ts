import { createDatabaseClient } from "@/lib/database/database-adapter"

/**
 * Check if a user is a Concur Administrator for the given organization.
 * Returns true if the user is explicitly in the concur_administrators table
 * OR if the user is an organization owner (implicit Concur admin).
 */
export async function isConcurAdmin(
  userId: string,
  orgId: string
): Promise<boolean> {
  const db = await createDatabaseClient()

  // Check explicit concur_administrators entry
  const { data: admin } = await db
    .from("concur_administrators")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (admin) return true

  // Check if user is an organization owner (implicit Concur admin)
  const { data: membership } = await db
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("role", "owner")
    .maybeSingle()

  return !!membership
}

import { queryOne } from "@/lib/database/pg-client"

/**
 * Check if a user is a Concur Administrator for the given organization.
 * Returns true if the user is explicitly in the concur_administrators table
 * OR if the user is an organization owner (implicit Concur admin).
 */
export async function isConcurAdmin(
  userId: string,
  orgId: string
): Promise<boolean> {
  // Check explicit concur_administrators entry
  const admin = await queryOne<{ id: string }>(
    `SELECT id FROM concur_administrators WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
    [userId, orgId]
  )
  if (admin) return true

  // Check if user is an organization owner (implicit Concur admin)
  const owner = await queryOne<{ role: string }>(
    `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2 AND role = 'owner' LIMIT 1`,
    [userId, orgId]
  )
  return !!owner
}

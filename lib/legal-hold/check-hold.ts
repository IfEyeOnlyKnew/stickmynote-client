import "server-only"
import { db } from "@/lib/database/pg-client"
import type { LegalHold } from "@/types/legal-hold"

/**
 * Check if a user has any active legal holds.
 * When orgId is omitted, checks across ALL organizations (used by delete-account).
 * Returns false gracefully if the legal_holds table doesn't exist yet.
 */
export async function isUnderLegalHold(
  userId: string,
  orgId?: string,
): Promise<boolean> {
  try {
    if (orgId) {
      const result = await db.query(
        `SELECT 1 FROM legal_holds
         WHERE user_id = $1 AND org_id = $2 AND status = 'active'
         LIMIT 1`,
        [userId, orgId],
      )
      return result.rows.length > 0
    }

    // No orgId — check all orgs (e.g. account deletion)
    const result = await db.query(
      `SELECT 1 FROM legal_holds
       WHERE user_id = $1 AND status = 'active'
       LIMIT 1`,
      [userId],
    )
    return result.rows.length > 0
  } catch {
    // Table may not exist if migration not run yet
    return false
  }
}

/**
 * Get all active legal holds for a user.
 * When orgId is omitted, returns holds across ALL organizations.
 */
export async function getActiveHolds(
  userId: string,
  orgId?: string,
): Promise<LegalHold[]> {
  try {
    if (orgId) {
      const result = await db.query(
        `SELECT lh.*,
                u.email AS user_email,
                u.full_name AS user_full_name,
                cb.email AS created_by_email
         FROM legal_holds lh
         JOIN users u ON u.id = lh.user_id
         JOIN users cb ON cb.id = lh.created_by
         WHERE lh.user_id = $1 AND lh.org_id = $2 AND lh.status = 'active'
         ORDER BY lh.created_at DESC`,
        [userId, orgId],
      )
      return result.rows
    }

    const result = await db.query(
      `SELECT lh.*,
              u.email AS user_email,
              u.full_name AS user_full_name,
              cb.email AS created_by_email
       FROM legal_holds lh
       JOIN users u ON u.id = lh.user_id
       JOIN users cb ON cb.id = lh.created_by
       WHERE lh.user_id = $1 AND lh.status = 'active'
       ORDER BY lh.created_at DESC`,
      [userId],
    )
    return result.rows
  } catch {
    // Table may not exist if migration not run yet
    return []
  }
}

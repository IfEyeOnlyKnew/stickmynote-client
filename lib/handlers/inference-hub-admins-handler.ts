// Inference Hub Admins handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Constants
// ============================================================================

export const ADMIN_EMAILS = new Set(['chrisdoran63@outlook.com'])

// ============================================================================
// Core Logic
// ============================================================================

export function isGlobalAdmin(email: string | undefined | null): boolean {
  return ADMIN_EMAILS.has(email || '')
}

export async function getAdmins() {
  return { admins: [], currentUserRole: 'global_admin' }
}

export async function createAdmin(userId: string, role: string, grantedBy: string) {
  const result = await db.query(
    `INSERT INTO social_hub_admins (user_id, role, granted_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, role, grantedBy]
  )
  return result.rows[0]
}

export async function deleteAdmin(adminId: string) {
  await db.query(`DELETE FROM social_hub_admins WHERE id = $1`, [adminId])
}

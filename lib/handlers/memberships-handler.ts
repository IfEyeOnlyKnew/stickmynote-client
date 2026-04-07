// Memberships handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString } from '@/lib/api/validate'

export interface MembershipSession {
  user: { id: string; org_id?: string }
}

export interface AddMembershipInput {
  userId: string
  groupId: string
}

// List all memberships for the user's org
export async function listMemberships(session: MembershipSession) {
  try {
    const memberships = await query(
      `SELECT * FROM organization_members WHERE org_id = $1 ORDER BY joined_at DESC LIMIT 100`,
      [session.user.org_id]
    )
    return { status: 200, body: { memberships } }
  } catch {
    // Expected - database query may fail safely
    return { status: 500, body: { error: 'Failed to list memberships' } }
  }
}

// Add a membership
export async function addMembership(session: MembershipSession, input: AddMembershipInput) {
  try {
    const userId = requireString(input.userId, 'userId')
    const groupId = requireString(input.groupId, 'groupId')
    const membership = await querySingle(
      `INSERT INTO organization_members (org_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW()) RETURNING *`,
      [groupId, userId]
    )
    return { status: 201, body: { membership } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to add membership' } }
  }
}

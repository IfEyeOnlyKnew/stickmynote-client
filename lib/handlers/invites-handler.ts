// Invites handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString } from '@/lib/api/validate'

export interface InviteSession {
  user: { id: string; org_id?: string }
}

export interface AcceptInviteInput {
  token: string
}

// List all pending invites (for admin/user)
export async function listInvites(session: InviteSession) {
  try {
    const invites = await query(
      `SELECT * FROM organization_invites WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [session.user.org_id]
    )
    return { status: 200, body: { invites } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list invites' } }
  }
}

// Accept an invite by token
export async function acceptInvite(session: InviteSession, input: AcceptInviteInput) {
  try {
    const userId = session.user.id
    const token = requireString(input.token, 'token')
    // Find invite by token
    const invite = await querySingle(
      `SELECT * FROM organization_invites WHERE token = $1 AND status = 'pending'`,
      [token]
    )
    if (!invite) {
      return { status: 404, body: { error: 'Invite not found or already accepted' } }
    }
    // Accept invite and add to organization
    await query(
      `UPDATE organization_invites SET status = 'accepted', accepted_by = $1, accepted_at = NOW() WHERE id = $2`,
      [userId, invite.id]
    )
    await query(
      `INSERT INTO organization_members (org_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
      [invite.org_id, userId, invite.role]
    )
    return { status: 200, body: { success: true } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to accept invite' } }
  }
}

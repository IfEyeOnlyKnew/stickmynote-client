// Inference Pads Members handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'
import type { OrgContext } from '@/lib/auth/get-org-context'

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedContext {
  user: { id: string }
  orgContext: OrgContext
}

// ============================================================================
// Constants
// ============================================================================

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// ============================================================================
// Helpers
// ============================================================================

export function normalizeRole(role: string): string | null {
  if (role === 'member') return 'viewer'
  return (VALID_ROLES as readonly string[]).includes(role) ? role : null
}

async function checkPadAccess(padId: string, userId: string, orgId: string) {
  const padResult = await db.query(
    `SELECT owner_id, name FROM social_pads WHERE id = $1 AND org_id = $2`,
    [padId, orgId]
  )

  if (padResult.rows.length === 0) {
    return { pad: null, membership: null, canManage: false }
  }

  const pad = padResult.rows[0]

  const memberResult = await db.query(
    `SELECT role, admin_level FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [padId, userId, orgId]
  )

  const membership = memberResult.rows[0] || null
  const canManage = pad.owner_id === userId || membership?.admin_level === 'owner' || membership?.role === 'admin'

  return { pad, membership, canManage }
}

async function sendInviteEmail(
  email: string,
  padName: string,
  role: string,
  padId: string,
  isNewUser: boolean
): Promise<void> {
  const padUrl = `${SITE_URL}/social/pads/${padId}`
  const authUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(padUrl)}`

  const subject = isNewUser
    ? `You've been invited to join "${padName}" on Stick My Note`
    : `You've been added to "${padName}" on Stick My Note`

  const actionText = isNewUser ? 'invited to join' : 'added to'
  const buttonText = isNewUser ? `Sign In & Join ${padName}` : `View ${padName}`

  try {
    await fetch(`${SITE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been ${actionText} a Social Pad!</h2>
            <p>You've been ${actionText} "<strong>${padName}</strong>" with the role of <strong>${role}</strong>.</p>
            <a href="${authUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
              ${buttonText}
            </a>
          </div>
        `,
        text: `You've been ${actionText} "${padName}" with role ${role}. Access it at: ${authUrl}`,
      }),
    })
  } catch (e) {
    console.error('[InferencePadMembers] Email send error:', e)
  }
}

// ============================================================================
// GET: List pad members
// ============================================================================

export async function listPadMembers(
  padId: string,
  ctx: AuthenticatedContext,
  searchQuery?: string,
  limit?: number
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  const { pad, membership } = await checkPadAccess(padId, user.id, orgContext.orgId)

  if (!pad) {
    return { status: 404, body: { error: 'Pad not found' } }
  }

  if (!membership && pad.owner_id !== user.id) {
    return { status: 403, body: { error: 'Access denied' } }
  }

  // Get members with user info
  const membersResult = await db.query(
    `SELECT spm.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url, u.hourly_rate_cents
     FROM social_pad_members spm
     LEFT JOIN users u ON spm.user_id = u.id
     WHERE spm.social_pad_id = $1 AND spm.org_id = $2
     ORDER BY spm.created_at ASC`,
    [padId, orgContext.orgId]
  )

  const members = membersResult.rows.map((row: any) => ({
    id: row.id,
    social_pad_id: row.social_pad_id,
    user_id: row.uid || row.user_id,
    role: row.role,
    accepted: row.accepted,
    invited_by: row.invited_by,
    org_id: row.org_id,
    admin_level: row.admin_level,
    created_at: row.created_at,
    users: {
      id: row.uid || row.user_id,
      full_name: row.full_name,
      username: row.username,
      email: row.email,
      avatar_url: row.avatar_url,
      hourly_rate_cents: row.hourly_rate_cents,
    },
  }))

  return {
    status: 200,
    body: { members, isOwner: pad.owner_id === user.id },
  }
}

// ============================================================================
// POST: Add pad member
// ============================================================================

export async function addPadMember(
  padId: string,
  email: string,
  requestedRole: string,
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  if (!email || !requestedRole) {
    return { status: 400, body: { error: 'Email and role are required' } }
  }

  const role = normalizeRole(requestedRole)
  if (!role) {
    return { status: 400, body: { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` } }
  }

  const { pad, canManage } = await checkPadAccess(padId, user.id, orgContext.orgId)

  if (!pad) {
    return { status: 404, body: { error: 'Pad not found' } }
  }

  if (!canManage) {
    return { status: 403, body: { error: 'Permission denied' } }
  }

  // Check if user exists
  const userResult = await db.query(
    `SELECT id, email, full_name FROM users WHERE email = $1`,
    [email]
  )

  if (userResult.rows.length > 0) {
    const invitedUser = userResult.rows[0]

    // Check if already a member
    const existingResult = await db.query(
      `SELECT id FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND org_id = $3`,
      [padId, invitedUser.id, orgContext.orgId]
    )

    if (existingResult.rows.length > 0) {
      return { status: 400, body: { error: 'User is already a member of this pad' } }
    }

    // Add as member
    const memberResult = await db.query(
      `INSERT INTO social_pad_members
       (social_pad_id, user_id, role, invited_by, accepted, org_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [padId, invitedUser.id, role, user.id, true, orgContext.orgId]
    )

    const newMember = memberResult.rows[0]

    await sendInviteEmail(email, pad.name || 'Social Pad', role, padId, false)

    return {
      status: 200,
      body: {
        member: {
          ...newMember,
          users: { id: invitedUser.id, email: invitedUser.email, full_name: invitedUser.full_name },
        },
        userExists: true,
      },
    }
  } else {
    // Create pending invite
    const existingInviteResult = await db.query(
      `SELECT id FROM social_pad_pending_invites
       WHERE social_pad_id = $1 AND email = $2 AND org_id = $3`,
      [padId, email, orgContext.orgId]
    )

    if (existingInviteResult.rows.length > 0) {
      return { status: 400, body: { error: 'An invitation has already been sent to this email' } }
    }

    await db.query(
      `INSERT INTO social_pad_pending_invites
       (social_pad_id, email, role, invited_by, org_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [padId, email, role, user.id, orgContext.orgId]
    )

    await sendInviteEmail(email, pad.name || 'Social Pad', role, padId, true)

    return {
      status: 200,
      body: {
        success: true,
        userExists: false,
        message: 'Invitation email sent successfully.',
      },
    }
  }
}

// ============================================================================
// PATCH: Update pad member
// ============================================================================

export async function updatePadMember(
  padId: string,
  input: { memberId: string; role?: string; hourlyRateCents?: number },
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx
  const { memberId, role, hourlyRateCents } = input

  if (!memberId) {
    return { status: 400, body: { error: 'Member ID is required' } }
  }

  if (!role && hourlyRateCents === undefined) {
    return { status: 400, body: { error: 'At least one update field (role or hourlyRateCents) is required' } }
  }

  const { pad, canManage } = await checkPadAccess(padId, user.id, orgContext.orgId)

  if (!pad) {
    return { status: 404, body: { error: 'Pad not found' } }
  }

  if (!canManage) {
    return { status: 403, body: { error: 'Permission denied' } }
  }

  if (role) {
    const normalizedRole = normalizeRole(role)
    if (!normalizedRole) {
      return { status: 400, body: { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` } }
    }

    await db.query(
      `UPDATE social_pad_members SET role = $1
       WHERE id = $2 AND social_pad_id = $3 AND org_id = $4`,
      [normalizedRole, memberId, padId, orgContext.orgId]
    )
  }

  if (hourlyRateCents !== undefined) {
    const memberDataResult = await db.query(
      `SELECT user_id FROM social_pad_members WHERE id = $1 AND org_id = $2`,
      [memberId, orgContext.orgId]
    )
    if (memberDataResult.rows.length > 0) {
      await db.query(
        `UPDATE users SET hourly_rate_cents = $1 WHERE id = $2`,
        [hourlyRateCents, memberDataResult.rows[0].user_id]
      )
    }
  }

  // Get updated member with user info
  const updatedResult = await db.query(
    `SELECT spm.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url, u.hourly_rate_cents
     FROM social_pad_members spm
     LEFT JOIN users u ON spm.user_id = u.id
     WHERE spm.id = $1 AND spm.social_pad_id = $2 AND spm.org_id = $3`,
    [memberId, padId, orgContext.orgId]
  )

  const row = updatedResult.rows[0]
  const member = row
    ? {
        ...row,
        users: {
          id: row.uid,
          full_name: row.full_name,
          username: row.username,
          email: row.email,
          avatar_url: row.avatar_url,
          hourly_rate_cents: row.hourly_rate_cents,
        },
      }
    : null

  return { status: 200, body: { member } }
}

// ============================================================================
// DELETE: Remove pad member
// ============================================================================

export async function removePadMember(
  padId: string,
  memberId: string,
  ctx: AuthenticatedContext
): Promise<{ status: number; body: any }> {
  const { user, orgContext } = ctx

  if (!memberId) {
    return { status: 400, body: { error: 'Member ID is required' } }
  }

  const { pad, canManage } = await checkPadAccess(padId, user.id, orgContext.orgId)

  if (!pad) {
    return { status: 404, body: { error: 'Pad not found' } }
  }

  if (!canManage) {
    return { status: 403, body: { error: 'Permission denied' } }
  }

  await db.query(
    `DELETE FROM social_pad_members
     WHERE id = $1 AND social_pad_id = $2 AND org_id = $3`,
    [memberId, padId, orgContext.orgId]
  )

  return { status: 200, body: { success: true } }
}

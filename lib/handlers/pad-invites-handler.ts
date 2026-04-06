// Pad invites handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Types
// ============================================================================

export type DbRole = 'admin' | 'edit' | 'view'

export interface PadInviteUser {
  id: string
  email?: string
}

export interface PadInviteOrgContext {
  orgId: string
}

export interface InviteResults {
  success: any[]
  failed: any[]
  total: number
}

// ============================================================================
// Constants
// ============================================================================

export const VALID_ROLES = new Set(['admin', 'editor', 'viewer', 'edit', 'view'])
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const ROLE_MAP: Record<string, DbRole> = {
  admin: 'admin',
  editor: 'edit',
  viewer: 'view',
  edit: 'edit',
  view: 'view',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'manage members and have full access to all sticks',
  editor: 'create and edit sticks',
  edit: 'create and edit sticks',
  viewer: 'view sticks and replies',
  view: 'view sticks and replies',
}

// ============================================================================
// Helpers
// ============================================================================

export function mapRoleForDatabase(role: string): DbRole {
  return ROLE_MAP[role.toLowerCase()] || 'view'
}

export function getDisplayRole(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'editor' || normalized === 'edit') return 'Editor'
  return 'Viewer'
}

export function createInviteResults(): InviteResults {
  return { success: [], failed: [], total: 0 }
}

// ============================================================================
// Pad access verification
// ============================================================================

export async function fetchPadAndVerifyAccess(
  padId: string,
  orgId: string,
  userId: string,
): Promise<{ pad: any; error?: string; status?: number }> {
  const padResult = await db.query(
    `SELECT p.*,
      (SELECT json_agg(m) FROM paks_pad_members m WHERE m.pad_id = p.id) as members
     FROM paks_pads p
     WHERE p.id = $1 AND p.org_id = $2`,
    [padId, orgId],
  )

  if (padResult.rows.length === 0) {
    return { pad: null, error: 'Pad not found', status: 404 }
  }

  const pad = padResult.rows[0]

  // Check if user can invite
  const isOwner = pad.owner_id === userId
  const isAdmin = (pad.members || []).some(
    (m: any) => m.user_id === userId && m.role === 'admin' && m.accepted,
  )

  if (!isOwner && !isAdmin) {
    return { pad: null, error: 'Only pad owners or admins can invite members', status: 403 }
  }

  return { pad }
}

// ============================================================================
// Send invitation email
// ============================================================================

async function sendInvitationEmail(params: {
  toEmail: string
  toName: string
  padName: string
  role: string
  inviterName: string
  padLink: string
  isNewUser?: boolean
}): Promise<void> {
  try {
    const { toEmail, toName, padName, role, inviterName, padLink, isNewUser = false } = params
    const normalizedRole = role.toLowerCase()
    const description = ROLE_DESCRIPTIONS[normalizedRole] || 'access this pad'
    const displayRole = getDisplayRole(role)

    const padPath = '/pads/' + padLink.split('/').pop()
    const actionLink = isNewUser
      ? `${SITE_URL}/auth/login?redirect=${encodeURIComponent(padPath)}`
      : padLink

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You've been invited to collaborate!</h2>
        <p>Hello ${toName},</p>
        <p>${inviterName} has invited you to join the pad "<strong>${padName}</strong>" with <strong>${displayRole}</strong> access.</p>
        ${isNewUser ? "<p>You'll need to create an account or log in first. After authenticating, you'll automatically be redirected to the pad.</p>" : '<p>Click the button below to access the pad. You may need to log in first.</p>'}
        <div style="margin: 30px 0;">
          <a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            ${isNewUser ? 'Log In & Join Pad' : 'Accept Invitation'}
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          <strong>Access level: ${displayRole}</strong><br>
          As a ${normalizedRole}, you can ${description}.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          This invitation was sent from Stick My Note. If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `

    await fetch(`${SITE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toEmail,
        subject: `Invitation to join "${padName}" pad`,
        html,
      }),
    })
  } catch (error) {
    console.error('Error sending invitation email:', error)
  }
}

// ============================================================================
// Process user ID invites
// ============================================================================

export interface InviteContext {
  padId: string
  dbRole: DbRole
  orgId: string
  inviterId: string
  inviterEmail: string
  padName: string
  role: string
}

export async function processUserIdInvites(
  userIds: string[],
  ctx: InviteContext,
  results: InviteResults,
) {
  for (const userId of userIds) {
    try {
      const existingResult = await db.query(
        `SELECT id, accepted FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2 AND org_id = $3`,
        [ctx.padId, userId, ctx.orgId],
      )

      if (existingResult.rows.length > 0) {
        const reason = existingResult.rows[0].accepted
          ? 'Already a member'
          : 'Invitation already sent'
        results.failed.push({ userId, reason })
        continue
      }

      await db.query(
        `INSERT INTO paks_pad_members (pad_id, user_id, role, invited_by, invited_at, accepted, org_id)
         VALUES ($1, $2, $3, $4, NOW(), true, $5)`,
        [ctx.padId, userId, ctx.dbRole, ctx.inviterId, ctx.orgId],
      )

      const userResult = await db.query(
        `SELECT email, full_name, username FROM users WHERE id = $1`,
        [userId],
      )

      if (userResult.rows[0]?.email) {
        const invitedUser = userResult.rows[0]
        await sendInvitationEmail({
          toEmail: invitedUser.email,
          toName: invitedUser.full_name || invitedUser.username || 'User',
          padName: ctx.padName,
          role: ctx.role,
          inviterName: ctx.inviterEmail || 'A team member',
          padLink: `${SITE_URL}/pads/${ctx.padId}`,
        })
      }

      results.success.push({ userId })
    } catch {
      results.failed.push({ userId, reason: 'Unexpected error' })
    }
  }
}

// ============================================================================
// Process email invites
// ============================================================================

export async function processEmailInvites(
  emails: string[],
  ctx: InviteContext,
  results: InviteResults,
) {
  for (const email of emails) {
    try {
      const existingUserResult = await db.query(`SELECT id FROM users WHERE email = $1`, [email])

      if (existingUserResult.rows.length > 0) {
        await processExistingUserEmailInvite(email, existingUserResult.rows[0].id, ctx, results)
      } else {
        await processNewUserEmailInvite(email, ctx, results)
      }
    } catch {
      results.failed.push({ email, reason: 'Unexpected error' })
    }
  }
}

async function processExistingUserEmailInvite(
  email: string,
  existingUserId: string,
  ctx: InviteContext,
  results: InviteResults,
) {
  const memberResult = await db.query(
    `SELECT id, accepted FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2 AND org_id = $3`,
    [ctx.padId, existingUserId, ctx.orgId],
  )

  if (memberResult.rows.length > 0) {
    const reason = memberResult.rows[0].accepted
      ? 'User already a member'
      : 'Invitation already sent'
    results.failed.push({ email, reason })
    return
  }

  await db.query(
    `INSERT INTO paks_pad_members (pad_id, user_id, role, invited_by, invited_at, accepted, org_id)
     VALUES ($1, $2, $3, $4, NOW(), true, $5)`,
    [ctx.padId, existingUserId, ctx.dbRole, ctx.inviterId, ctx.orgId],
  )

  await sendInvitationEmail({
    toEmail: email,
    toName: email.split('@')[0],
    padName: ctx.padName,
    role: ctx.role,
    inviterName: ctx.inviterEmail || 'A team member',
    padLink: `${SITE_URL}/pads/${ctx.padId}`,
  })

  results.success.push({ email })
}

async function processNewUserEmailInvite(
  email: string,
  ctx: InviteContext,
  results: InviteResults,
) {
  const pendingResult = await db.query(
    `SELECT id FROM paks_pad_pending_invites WHERE pad_id = $1 AND email = $2 AND org_id = $3`,
    [ctx.padId, email, ctx.orgId],
  )

  if (pendingResult.rows.length > 0) {
    results.failed.push({ email, reason: 'Invitation already sent' })
    return
  }

  await db.query(
    `INSERT INTO paks_pad_pending_invites (pad_id, email, role, invited_by, invited_at, org_id)
     VALUES ($1, $2, $3, $4, NOW(), $5)`,
    [ctx.padId, email, ctx.dbRole, ctx.inviterId, ctx.orgId],
  )

  await sendInvitationEmail({
    toEmail: email,
    toName: email.split('@')[0],
    padName: ctx.padName,
    role: ctx.role,
    inviterName: ctx.inviterEmail || 'A team member',
    padLink: `${SITE_URL}/auth/login?redirect=/pads/${ctx.padId}`,
    isNewUser: true,
  })

  results.success.push({ email })
}

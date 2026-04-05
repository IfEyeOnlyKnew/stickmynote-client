// v2 Pad Invites API: production-quality, invite members to pads
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

type DbRole = 'admin' | 'edit' | 'view'

const VALID_ROLES = new Set(['admin', 'editor', 'viewer', 'edit', 'view'])
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const ROLE_MAP: Record<string, DbRole> = {
  admin: 'admin',
  editor: 'edit',
  viewer: 'view',
  edit: 'edit',
  view: 'view',
}

function mapRoleForDatabase(role: string): DbRole {
  return ROLE_MAP[role.toLowerCase()] || 'view'
}

function getDisplayRole(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'editor' || normalized === 'edit') return 'Editor'
  return 'Viewer'
}

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
        <div style="margin: 30px 0;">
          <a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            ${isNewUser ? 'Log In & Join Pad' : 'Accept Invitation'}
          </a>
        </div>
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

interface InviteContext {
  padId: string
  dbRole: DbRole
  orgId: string
  inviterId: string
  inviterEmail: string
  padName: string
  role: string
}

async function processUserIdInvites(
  userIds: string[],
  ctx: InviteContext,
  results: { success: any[]; failed: any[] },
) {
  for (const userId of userIds) {
    try {
      const existingResult = await db.query(
        `SELECT id, accepted FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2 AND org_id = $3`,
        [ctx.padId, userId, ctx.orgId],
      )

      if (existingResult.rows.length > 0) {
        const reason = existingResult.rows[0].accepted ? 'Already a member' : 'Invitation already sent'
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

async function processEmailInvites(
  emails: string[],
  ctx: InviteContext,
  results: { success: any[]; failed: any[] },
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
  results: { success: any[]; failed: any[] },
) {
  const memberResult = await db.query(
    `SELECT id, accepted FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2 AND org_id = $3`,
    [ctx.padId, existingUserId, ctx.orgId],
  )

  if (memberResult.rows.length > 0) {
    const reason = memberResult.rows[0].accepted ? 'User already a member' : 'Invitation already sent'
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
  results: { success: any[]; failed: any[] },
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

// POST /api/v2/pad-invites - Invite members to a pad
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { padId, role, userIds, emails } = await request.json()

    if (!padId || !role) {
      return new Response(JSON.stringify({ error: 'Missing padId or role' }), { status: 400 })
    }

    if (!VALID_ROLES.has(role.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, editor, or viewer' }),
        { status: 400 }
      )
    }

    const dbRole = mapRoleForDatabase(role)

    // Fetch pad and verify permissions
    const padResult = await db.query(
      `SELECT p.*,
        (SELECT json_agg(m) FROM paks_pad_members m WHERE m.pad_id = p.id) as members
       FROM paks_pads p
       WHERE p.id = $1 AND p.org_id = $2`,
      [padId, orgContext.orgId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const pad = padResult.rows[0]

    // Check if user can invite
    const isOwner = pad.owner_id === user.id
    const isAdmin = (pad.members || []).some(
      (m: any) => m.user_id === user.id && m.role === 'admin' && m.accepted
    )

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only pad owners or admins can invite members' }),
        { status: 403 }
      )
    }

    const results = { success: [] as any[], failed: [] as any[], total: 0 }

    // Process user ID invites
    if (userIds?.length) {
      await processUserIdInvites(userIds, { padId, dbRole, orgId: orgContext.orgId, inviterId: user.id, inviterEmail: user.email || '', padName: pad.name, role }, results)
    }

    // Process email invites
    if (emails?.length) {
      await processEmailInvites(emails, { padId, dbRole, orgId: orgContext.orgId, inviterId: user.id, inviterEmail: user.email || '', padName: pad.name, role }, results)
    }

    results.total = results.success.length + results.failed.length

    return new Response(JSON.stringify({ success: true, summary: results }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

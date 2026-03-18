// v2 Social Pads Members API: production-quality, manage pad members
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['admin', 'editor', 'viewer']
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Helper to check membership and permissions
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

// GET /api/v2/inference-pads/[padId]/members - List members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', members: [], isOwner: false }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    const { pad, membership } = await checkPadAccess(padId, user.id, orgContext.orgId)

    if (!pad) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    if (!membership && pad.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }

    // Get members with user info
    const membersResult = await db.query(
      `SELECT spm.*, u.id as user_id, u.full_name, u.username, u.email, u.avatar_url, u.hourly_rate_cents
       FROM social_pad_members spm
       LEFT JOIN users u ON spm.user_id = u.id
       WHERE spm.social_pad_id = $1 AND spm.org_id = $2
       ORDER BY spm.created_at ASC`,
      [padId, orgContext.orgId]
    )

    const members = membersResult.rows.map((row: any) => ({
      id: row.id,
      social_pad_id: row.social_pad_id,
      user_id: row.user_id,
      role: row.role,
      accepted: row.accepted,
      invited_by: row.invited_by,
      org_id: row.org_id,
      admin_level: row.admin_level,
      created_at: row.created_at,
      users: {
        id: row.user_id,
        full_name: row.full_name,
        username: row.username,
        email: row.email,
        avatar_url: row.avatar_url,
        hourly_rate_cents: row.hourly_rate_cents,
      },
    }))

    return new Response(
      JSON.stringify({ members, isOwner: pad.owner_id === user.id }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-pads/[padId]/members - Add member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    const { pad, canManage } = await checkPadAccess(padId, user.id, orgContext.orgId)

    if (!pad) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()
    const { email, role: requestedRole } = body

    if (!email || !requestedRole) {
      return new Response(JSON.stringify({ error: 'Email and role are required' }), { status: 400 })
    }

    // Normalize role
    let role = requestedRole === 'member' ? 'viewer' : requestedRole
    if (!VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }),
        { status: 400 }
      )
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
        return new Response(
          JSON.stringify({ error: 'User is already a member of this pad' }),
          { status: 400 }
        )
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

      return new Response(
        JSON.stringify({
          member: {
            ...newMember,
            users: { id: invitedUser.id, email: invitedUser.email, full_name: invitedUser.full_name },
          },
          userExists: true,
        }),
        { status: 200 }
      )
    } else {
      // Create pending invite
      const existingInviteResult = await db.query(
        `SELECT id FROM social_pad_pending_invites
         WHERE social_pad_id = $1 AND email = $2 AND org_id = $3`,
        [padId, email, orgContext.orgId]
      )

      if (existingInviteResult.rows.length > 0) {
        return new Response(
          JSON.stringify({ error: 'An invitation has already been sent to this email' }),
          { status: 400 }
        )
      }

      await db.query(
        `INSERT INTO social_pad_pending_invites
         (social_pad_id, email, role, invited_by, org_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [padId, email, role, user.id, orgContext.orgId]
      )

      return new Response(
        JSON.stringify({
          success: true,
          userExists: false,
          message: 'Invitation email sent successfully.',
        }),
        { status: 200 }
      )
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/inference-pads/[padId]/members - Update member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    const { pad, canManage } = await checkPadAccess(padId, user.id, orgContext.orgId)

    if (!pad) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()
    const { memberId, role, hourlyRateCents } = body

    if (!memberId) {
      return new Response(JSON.stringify({ error: 'Member ID is required' }), { status: 400 })
    }

    if (!role && hourlyRateCents === undefined) {
      return new Response(
        JSON.stringify({ error: 'At least one update field (role or hourlyRateCents) is required' }),
        { status: 400 }
      )
    }

    if (role) {
      const normalizedRole = role === 'member' ? 'viewer' : role
      if (!VALID_ROLES.includes(normalizedRole)) {
        return new Response(
          JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }),
          { status: 400 }
        )
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

    return new Response(JSON.stringify({ member }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-pads/[padId]/members - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    const { pad, canManage } = await checkPadAccess(padId, user.id, orgContext.orgId)

    if (!pad) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return new Response(JSON.stringify({ error: 'Member ID is required' }), { status: 400 })
    }

    await db.query(
      `DELETE FROM social_pad_members
       WHERE id = $1 AND social_pad_id = $2 AND org_id = $3`,
      [memberId, padId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

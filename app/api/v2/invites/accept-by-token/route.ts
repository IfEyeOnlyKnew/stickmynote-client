// v2 Invites Accept By Token API: production-quality, accept organization invite
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/invites/accept-by-token - Accept organization invite by token
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
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }
    const user = authResult.user

    const { token } = await request.json()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), { status: 400 })
    }

    // Find the invite
    const inviteResult = await db.query(
      `SELECT oi.*, o.name as organization_name
       FROM organization_invites oi
       LEFT JOIN organizations o ON o.id = oi.org_id
       WHERE oi.token = $1 AND oi.status = 'pending'`,
      [token]
    )

    if (inviteResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation link' }),
        { status: 404 }
      )
    }

    const invite = inviteResult.rows[0]

    // Check email match
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: 'Email mismatch',
          code: 'EMAIL_MISMATCH',
          inviteEmail: invite.email,
          userEmail: user.email,
        }),
        { status: 403 }
      )
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invitation has expired', code: 'EXPIRED' }),
        { status: 410 }
      )
    }

    // Check if already a member
    const existingResult = await db.query(
      `SELECT id FROM organization_members WHERE org_id = $1 AND user_id = $2`,
      [invite.org_id, user.id]
    )

    if (existingResult.rows.length > 0) {
      // Already a member - just mark invite as accepted
      await db.query(
        `UPDATE organization_invites SET status = 'accepted' WHERE id = $1`,
        [invite.id]
      )

      return new Response(
        JSON.stringify({
          success: true,
          orgId: invite.org_id,
          alreadyMember: true,
        }),
        { status: 200 }
      )
    }

    // Add user to organization
    await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, invited_by, joined_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [invite.org_id, user.id, invite.role, invite.invited_by]
    )

    // Mark invite as accepted
    await db.query(
      `UPDATE organization_invites SET status = 'accepted' WHERE id = $1`,
      [invite.id]
    )

    return new Response(
      JSON.stringify({
        success: true,
        orgId: invite.org_id,
        organizationName: invite.organization_name,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

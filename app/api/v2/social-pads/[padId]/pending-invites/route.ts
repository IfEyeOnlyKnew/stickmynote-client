// v2 Social Pads Pending Invites API: production-quality, manage pending invites
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-pads/[padId]/pending-invites - Get pending invites
export async function GET(
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Check access
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const membershipResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [padId, user.id, orgContext.orgId]
    )

    const canView = padResult.rows[0].owner_id === user.id || membershipResult.rows[0]?.role === 'admin'

    if (!canView) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    // Get pending invites
    const invitesResult = await db.query(
      `SELECT * FROM social_pad_pending_invites
       WHERE social_pad_id = $1 AND org_id = $2
       ORDER BY invited_at DESC`,
      [padId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ pendingInvites: invitesResult.rows }), { status: 200 })
  } catch (error: any) {
    // Handle case where table doesn't exist
    if (error.code === '42P01') {
      return new Response(JSON.stringify({ pendingInvites: [] }), { status: 200 })
    }
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-pads/[padId]/pending-invites - Delete pending invite
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get('inviteId')

    if (!inviteId) {
      return new Response(JSON.stringify({ error: 'Invite ID is required' }), { status: 400 })
    }

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

    // Check access
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const membershipResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [padId, user.id, orgContext.orgId]
    )

    const canDelete = padResult.rows[0].owner_id === user.id || membershipResult.rows[0]?.role === 'admin'

    if (!canDelete) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    await db.query(
      `DELETE FROM social_pad_pending_invites
       WHERE id = $1 AND social_pad_id = $2 AND org_id = $3`,
      [inviteId, padId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Pads Pending Invites API: production-quality, manage pending invites
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { checkPadInviteAccess, getPendingInvites, deletePendingInvite } from '@/lib/handlers/inference-pads-pending-invites-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-pads/[padId]/pending-invites - Get pending invites
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { canManage, padExists } = await checkPadInviteAccess(padId, authResult.user.id, orgContext.orgId)
    if (!padExists) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const pendingInvites = await getPendingInvites(padId, orgContext.orgId)
    return new Response(JSON.stringify({ pendingInvites }), { status: 200 })
  } catch (error: any) {
    if (error.code === '42P01') {
      return new Response(JSON.stringify({ pendingInvites: [] }), { status: 200 })
    }
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-pads/[padId]/pending-invites - Delete pending invite
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { canManage, padExists } = await checkPadInviteAccess(padId, authResult.user.id, orgContext.orgId)
    if (!padExists) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    await deletePendingInvite(inviteId, padId, orgContext.orgId)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Organization Pad Invite Details API: production-quality, get invite details for a pad within an organization
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/pads/[padId]/invites/[inviteId] - Get invite details for a pad within an organization
export async function GET(request: NextRequest, { params }: { params: { orgId: string, padId: string, inviteId: string } }) {
  try {
    const session = await requireADSession(request)
    const orgId = params.orgId
    const padId = params.padId
    const inviteId = params.inviteId
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const invite = await querySingle(
      `SELECT * FROM invites WHERE id = $1 AND pad_id = $2 AND org_id = $3`,
      [inviteId, padId, orgId]
    )
    if (!invite) return new Response(JSON.stringify({ error: 'Invite not found' }), { status: 404 })
    return new Response(JSON.stringify({ invite }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

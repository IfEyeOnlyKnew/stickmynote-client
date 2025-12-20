// v2 Organization Pad Social API: production-quality, list social notifications for a pad within an organization
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/pads/[padId]/social - List social notifications for a pad within an organization
export async function GET(request: NextRequest, { params }: { params: { orgId: string, padId: string } }) {
  try {
    const session = await requireADSession(request)
    const orgId = params.orgId
    const padId = params.padId
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const notifications = await query(
      `SELECT * FROM social_notifications WHERE pad_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [padId, orgId]
    )
    return new Response(JSON.stringify({ notifications }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

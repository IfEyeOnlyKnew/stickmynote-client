// v2 Organization Pad Details API: production-quality, get pad by org and pad ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/pads/[padId] - Get pad details by org and pad ID
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
    const pad = await querySingle(
      `SELECT * FROM pads WHERE id = $1 AND org_id = $2`,
      [padId, orgId]
    )
    if (!pad) return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    return new Response(JSON.stringify({ pad }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

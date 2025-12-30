// v2 Organization Pad Analytics Details API: production-quality, get analytics details for a pad within an organization
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/pads/[padId]/analytics/[analyticsId] - Get analytics details for a pad within an organization
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string, padId: string, analyticsId: string }> }) {
  try {
    const { orgId, padId, analyticsId } = await params
    const session = await requireADSession(request)
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const analytics = await querySingle(
      `SELECT * FROM analytics WHERE id = $1 AND pad_id = $2 AND org_id = $3`,
      [analyticsId, padId, orgId]
    )
    if (!analytics) return new Response(JSON.stringify({ error: 'Analytics not found' }), { status: 404 })
    return new Response(JSON.stringify({ analytics }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

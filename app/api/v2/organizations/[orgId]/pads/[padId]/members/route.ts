// v2 Organization Pad Members API: production-quality, list members for a pad within an organization
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/pads/[padId]/members - List members for a pad within an organization
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string, padId: string }> }) {
  try {
    const { orgId, padId } = await params
    const session = await requireADSession(request)
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const members = await query(
      `SELECT u.id, u.display_name, u.email FROM users u
       JOIN pads p ON u.id = ANY(p.shared_with)
       WHERE p.id = $1 AND p.org_id = $2`,
      [padId, orgId]
    )
    return new Response(JSON.stringify({ members }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

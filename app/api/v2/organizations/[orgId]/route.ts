// v2 Organization Details API: production-quality, get organization by ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId] - Get organization details by ID
export async function GET(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const session = await requireADSession(request)
    const orgId = params.orgId
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const org = await querySingle(
      `SELECT id, name, dn_pattern, created_at FROM organizations WHERE id = $1`,
      [orgId]
    )
    if (!org) return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404 })
    return new Response(JSON.stringify({ organization: org }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

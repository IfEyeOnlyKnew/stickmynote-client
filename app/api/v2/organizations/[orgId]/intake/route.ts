// v2 Organization Intake API: production-quality, list intake forms for an organization
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/intake - List intake forms for an organization
export async function GET(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const session = await requireADSession(request)
    const orgId = params.orgId
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const intakeForms = await query(
      `SELECT * FROM intake_forms WHERE org_id = $1 ORDER BY submitted_at DESC`,
      [orgId]
    )
    return new Response(JSON.stringify({ intakeForms }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

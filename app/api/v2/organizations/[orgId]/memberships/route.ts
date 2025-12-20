// v2 Organization Memberships API: production-quality, list user memberships for an organization
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/memberships - List user memberships for an organization
export async function GET(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const session = await requireADSession(request)
    const orgId = params.orgId
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const memberships = await query(
      `SELECT m.user_id, u.display_name, u.email, m.role, m.joined_at
       FROM organization_memberships m
       JOIN users u ON m.user_id = u.id
       WHERE m.organization_id = $1
       ORDER BY m.joined_at DESC`,
      [orgId]
    )
    return new Response(JSON.stringify({ memberships }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

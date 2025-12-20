// v2 Pad Members API: production-quality, list members for a pad
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/pads/[padId]/members - List members for a pad
export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const padId = params.padId
    // Only return members if user has access to the pad
    const members = await query(
      `SELECT u.id, u.display_name, u.email FROM users u
       JOIN pads p ON u.id = ANY(p.shared_with)
       WHERE p.id = $1 AND p.org_id = $2 AND (p.owner_id = $3 OR $3 = ANY(p.shared_with))`,
      [padId, orgId, userId]
    )
    return new Response(JSON.stringify({ members }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

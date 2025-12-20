// v2 Pad Analytics API: production-quality, analytics for a pad
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/pads/[padId]/analytics - Analytics for a pad
export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const padId = params.padId
    // Only return analytics if user has access to the pad
    const analytics = await query(
      `SELECT a.* FROM analytics a
       JOIN pads p ON a.pad_id = p.id
       WHERE p.id = $1 AND p.org_id = $2 AND (p.owner_id = $3 OR $3 = ANY(p.shared_with))
       ORDER BY a.timestamp DESC`,
      [padId, orgId, userId]
    )
    return new Response(JSON.stringify({ analytics }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

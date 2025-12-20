// v2 User Accessible Pads API: production-quality
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/user/accessible-pads - Pads user can access (owned or member)
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const pads = await query(
      `SELECT * FROM pads WHERE org_id = $1 AND (owner_id = $2 OR $2 = ANY(member_ids)) ORDER BY updated_at DESC`,
      [orgId, userId]
    )
    return new Response(JSON.stringify({ pads }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

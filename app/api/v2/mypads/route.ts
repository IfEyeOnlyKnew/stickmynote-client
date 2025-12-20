// v2 MyPads API: production-quality, list pads owned by user
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/mypads - List pads owned by user
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const pads = await query(
      `SELECT * FROM pads WHERE owner_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [userId, orgId]
    )
    return new Response(JSON.stringify({ pads }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

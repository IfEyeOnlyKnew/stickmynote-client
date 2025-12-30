// v2 Pad Uploads API: production-quality, list uploads for a pad
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/pads/[padId]/uploads - List uploads for a pad
export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    // Only return uploads if user has access to the pad
    const uploads = await query(
      `SELECT u.* FROM uploads u
       JOIN pads p ON u.pad_id = p.id
       WHERE p.id = $1 AND p.org_id = $2 AND (p.owner_id = $3 OR $3 = ANY(p.shared_with))
       ORDER BY u.created_at DESC`,
      [padId, orgId, userId]
    )
    return new Response(JSON.stringify({ uploads }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

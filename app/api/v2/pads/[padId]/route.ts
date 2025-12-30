// v2 Pad Details API: production-quality, get pad by ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/pads/[padId] - Get pad details by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const pad = await querySingle(
      `SELECT * FROM pads WHERE id = $1 AND org_id = $2 AND (owner_id = $3 OR $3 = ANY(shared_with))`,
      [padId, orgId, userId]
    )
    if (!pad) return new Response(JSON.stringify({ error: 'Pad not found or access denied' }), { status: 404 })
    return new Response(JSON.stringify({ pad }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

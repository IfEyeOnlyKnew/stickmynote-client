// v2 User Pad Details API: production-quality, get pad by user and pad ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/pads/[padId] - Get pad details by user and pad ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string, padId: string }> }) {
  try {
    const { userId, padId } = await params
    const session = await requireADSession(request)
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const pad = await querySingle(
      `SELECT * FROM pads WHERE id = $1 AND owner_id = $2`,
      [padId, userId]
    )
    if (!pad) return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    return new Response(JSON.stringify({ pad }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

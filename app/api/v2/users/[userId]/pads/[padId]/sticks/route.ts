// v2 User Pad Sticks API: production-quality, list sticks for a user's pad
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/pads/[padId]/sticks - List sticks for a user's pad
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string, padId: string }> }) {
  try {
    const { userId, padId } = await params
    const session = await requireADSession(request)
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const sticks = await query(
      `SELECT * FROM sticks WHERE pad_id = $1 AND owner_id = $2 ORDER BY created_at DESC`,
      [padId, userId]
    )
    return new Response(JSON.stringify({ sticks }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

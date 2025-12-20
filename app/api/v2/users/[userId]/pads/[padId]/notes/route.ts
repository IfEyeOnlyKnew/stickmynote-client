// v2 User Pad Notes API: production-quality, list notes for a user's pad
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/pads/[padId]/notes - List notes for a user's pad
export async function GET(request: NextRequest, { params }: { params: { userId: string, padId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    const padId = params.padId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const notes = await query(
      `SELECT * FROM notes WHERE pad_id = $1 AND owner_id = $2 ORDER BY created_at DESC`,
      [padId, userId]
    )
    return new Response(JSON.stringify({ notes }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Pad Notes API: production-quality, list notes for a pad
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/pads/[padId]/notes - List notes for a pad
export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    // Only return notes if user has access to the pad
    const notes = await query(
      `SELECT n.* FROM notes n
       JOIN pads p ON n.pad_id = p.id
       WHERE p.id = $1 AND p.org_id = $2 AND (p.owner_id = $3 OR $3 = ANY(p.shared_with))
       ORDER BY n.created_at DESC`,
      [padId, orgId, userId]
    )
    return new Response(JSON.stringify({ notes }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 User Memberships API: production-quality, list org memberships for a user
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/users/[userId]/memberships - List org memberships for a user
export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = params.userId
    // Only allow access if requesting own user or admin
    if (session.user.id !== userId && !session.user.is_admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const memberships = await query(
      `SELECT m.organization_id, o.name AS organization_name, m.role, m.joined_at
       FROM organization_memberships m
       JOIN organizations o ON m.organization_id = o.id
       WHERE m.user_id = $1
       ORDER BY m.joined_at DESC`,
      [userId]
    )
    return new Response(JSON.stringify({ memberships }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

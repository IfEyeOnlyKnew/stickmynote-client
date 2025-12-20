// v2 Escalations Acknowledge API: production-quality, acknowledge an escalation
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/escalations/[escalationId]/acknowledge - Acknowledge escalation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ escalationId: string }> }
) {
  try {
    const { escalationId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const result = await db.query(
      `UPDATE notification_escalations
       SET status = 'acknowledged',
           acknowledged_at = NOW(),
           acknowledged_by = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [user.id, escalationId, user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Escalation not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ escalation: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

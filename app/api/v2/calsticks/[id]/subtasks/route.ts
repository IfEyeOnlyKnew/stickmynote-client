// v2 Calsticks Subtasks API: production-quality, manage calstick subtasks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/[id]/subtasks - Get subtasks for a calstick
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const parentId = id

    const result = await db.query(
      `SELECT
        r.id, r.stick_id, r.user_id, r.content, r.color, r.is_calstick,
        r.calstick_date, r.calstick_completed, r.calstick_completed_at,
        r.calstick_priority, r.calstick_status, r.calstick_assignee_id,
        r.calstick_labels, r.calstick_parent_id, r.calstick_estimated_hours,
        r.calstick_actual_hours, r.calstick_start_date, r.calstick_description,
        r.calstick_progress, r.calstick_checklist_items, r.created_at, r.updated_at,
        json_build_object('id', u.id, 'username', u.username, 'full_name', u.full_name, 'email', u.email) as user
      FROM paks_pad_stick_replies r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.calstick_parent_id = $1 AND r.org_id = $2 AND r.is_calstick = true
      ORDER BY r.calstick_date ASC`,
      [parentId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ subtasks: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

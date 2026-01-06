// v2 Calsticks [id] API: production-quality, update individual calstick
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { CalstickCache } from '@/lib/calstick-cache'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// PATCH /api/v2/calsticks/[id] - Update a calstick
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const allowedFields = [
      'content',
      'color',
      'calstick_date',
      'calstick_completed',
      'calstick_completed_at',
      'calstick_progress',
      'calstick_status',
      'calstick_priority',
      'calstick_assignee_id',
      'calstick_estimated_hours',
      'calstick_actual_hours',
      'calstick_start_date',
      'calstick_description',
      'calstick_labels',
      'calstick_checklist_items',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`)
        values.push(body[field])
      }
    }

    updates.push(`updated_at = $${paramIndex++}`)
    values.push(new Date().toISOString())

    values.push(id, orgContext.orgId)

    const result = await db.query(
      `UPDATE paks_pad_stick_replies
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
       RETURNING *`,
      values
    )

    const calstick = result.rows[0]

    await CalstickCache.invalidateUser(user.id)

    return new Response(JSON.stringify(calstick), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

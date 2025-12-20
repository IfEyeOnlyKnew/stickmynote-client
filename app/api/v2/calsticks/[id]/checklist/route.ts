// v2 Calsticks Checklist API: production-quality, manage calstick checklists
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import type { ChecklistData } from '@/types/checklist'

export const dynamic = 'force-dynamic'

// PATCH /api/v2/calsticks/[id]/checklist - Update calstick checklist
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const calstickId = params.id
    const body = await request.json()
    const { checklist_items } = body as { checklist_items: ChecklistData }

    // Calculate progress from checklist
    const completedItems = checklist_items.items.filter((item) => item.completed).length
    const totalItems = checklist_items.items.length
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const result = await db.query(
      `UPDATE paks_pad_stick_replies
       SET calstick_checklist_items = $1, calstick_progress = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5 AND org_id = $6
       RETURNING *`,
      [
        JSON.stringify(checklist_items),
        progress,
        new Date().toISOString(),
        calstickId,
        user.id,
        orgContext.orgId,
      ]
    )

    return new Response(JSON.stringify({ calstick: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

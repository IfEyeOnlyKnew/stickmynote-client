// v2 Calsticks Progress API: production-quality, get calstick progress
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import type { TaskProgress } from '@/types/checklist'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/[id]/progress - Get calstick progress
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const calstickId = id

    // Get parent task
    const parentResult = await db.query(
      `SELECT calstick_checklist_items, calstick_progress, org_id
       FROM paks_pad_stick_replies
       WHERE id = $1 AND org_id = $2`,
      [calstickId, orgContext.orgId]
    )

    const parentTask = parentResult.rows[0]

    if (!parentTask) {
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 })
    }

    // Get subtasks
    const subtasksResult = await db.query(
      `SELECT calstick_completed
       FROM paks_pad_stick_replies
       WHERE calstick_parent_id = $1 AND org_id = $2 AND is_calstick = true`,
      [calstickId, orgContext.orgId]
    )

    // Calculate checklist progress
    const checklistData = parentTask.calstick_checklist_items as { items: any[] } | null
    const checklistItems = checklistData?.items || []
    const completedChecklistItems = checklistItems.filter((item) => item.completed).length
    const checklistPercentage =
      checklistItems.length > 0 ? (completedChecklistItems / checklistItems.length) * 100 : 0

    // Calculate subtasks progress
    const totalSubtasks = subtasksResult.rows.length
    const completedSubtasks = subtasksResult.rows.filter((st: any) => st.calstick_completed).length
    const subtasksPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

    // Calculate overall progress
    let overall = 0
    if (checklistItems.length > 0 && totalSubtasks > 0) {
      overall = (checklistPercentage + subtasksPercentage) / 2
    } else if (checklistItems.length > 0) {
      overall = checklistPercentage
    } else if (totalSubtasks > 0) {
      overall = subtasksPercentage
    }

    const progress: TaskProgress = {
      checklist: {
        total: checklistItems.length,
        completed: completedChecklistItems,
        percentage: Math.round(checklistPercentage),
      },
      subtasks: {
        total: totalSubtasks,
        completed: completedSubtasks,
        percentage: Math.round(subtasksPercentage),
      },
      overall: Math.round(overall),
    }

    return new Response(JSON.stringify({ progress }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Automation Recurring API: production-quality, manage recurring tasks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// Calculate next run date based on frequency
function calculateNextRun(start: Date, frequency: string, interval: number): Date {
  const next = new Date(start)

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval)
      break
    case 'weekly':
      next.setDate(next.getDate() + interval * 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + interval)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval)
      break
  }
  return next
}

// POST /api/v2/automation/recurring - Create recurring task
export async function POST(request: NextRequest) {
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
    const { taskId, frequency, interval = 1, days_of_week, end_date } = body

    if (!taskId || !frequency) {
      return new Response(JSON.stringify({ error: 'taskId and frequency are required' }), { status: 400 })
    }

    const nextRun = calculateNextRun(new Date(), frequency, interval)

    const result = await db.query(
      `INSERT INTO recurring_tasks (original_task_id, user_id, org_id, frequency, interval, days_of_week, end_date, next_run, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING *`,
      [
        taskId,
        user.id,
        orgContext.orgId,
        frequency,
        interval,
        days_of_week ? JSON.stringify(days_of_week) : null,
        end_date,
        nextRun.toISOString(),
      ]
    )

    return new Response(JSON.stringify({ recurring: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

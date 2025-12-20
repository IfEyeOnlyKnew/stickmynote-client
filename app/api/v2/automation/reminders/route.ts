// v2 Automation Reminders API: production-quality, manage task reminders
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/automation/reminders - Get reminders for a task
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Task ID required' }), { status: 400 })
    }

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

    const result = await db.query(
      `SELECT * FROM task_reminders
       WHERE task_id = $1 AND org_id = $2 AND is_sent = false
       ORDER BY remind_at ASC`,
      [taskId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ reminders: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/automation/reminders - Create reminder
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
    const { taskId, remind_at, reminder_type, message } = body

    if (!taskId || !remind_at || !reminder_type) {
      return new Response(JSON.stringify({ error: 'taskId, remind_at, and reminder_type are required' }), { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO task_reminders (task_id, user_id, org_id, remind_at, reminder_type, message, is_sent)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [taskId, user.id, orgContext.orgId, remind_at, reminder_type, message]
    )

    return new Response(JSON.stringify({ reminder: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

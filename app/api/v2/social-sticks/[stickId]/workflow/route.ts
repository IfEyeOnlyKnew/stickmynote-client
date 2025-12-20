// v2 Social Sticks Workflow API: production-quality, manage workflow status
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import type { WorkflowStatus } from '@/types/social-workflow'

export const dynamic = 'force-dynamic'

function mapWorkflowToCalstickStatus(workflowStatus: WorkflowStatus): string {
  const mapping: Record<WorkflowStatus, string> = {
    idea: 'todo',
    triage: 'todo',
    in_progress: 'in-progress',
    resolved: 'done',
  }
  return mapping[workflowStatus]
}

// GET /api/v2/social-sticks/[stickId]/workflow - Get workflow status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    // Get workflow info
    const stickResult = await db.query(
      `SELECT ss.id, ss.workflow_status, ss.workflow_owner_id, ss.workflow_due_date,
              ss.workflow_updated_at, ss.calstick_id, ss.promoted_at, ss.promoted_by,
              u.id as owner_uid, u.full_name as owner_name, u.email as owner_email, u.avatar_url as owner_avatar
       FROM social_sticks ss
       LEFT JOIN users u ON ss.workflow_owner_id = u.id
       WHERE ss.id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Get linked CalStick if exists
    let calstick = null
    if (stick.calstick_id) {
      const calstickResult = await db.query(
        `SELECT id, calstick_status, calstick_priority, calstick_completed,
                calstick_date, calstick_start_date, calstick_assignee_id
         FROM paks_pad_stick_replies
         WHERE id = $1`,
        [stick.calstick_id]
      )
      calstick = calstickResult.rows[0] || null
    }

    return new Response(
      JSON.stringify({
        workflow: {
          id: stick.id,
          workflow_status: stick.workflow_status,
          workflow_owner_id: stick.workflow_owner_id,
          workflow_due_date: stick.workflow_due_date,
          workflow_updated_at: stick.workflow_updated_at,
          calstick_id: stick.calstick_id,
          promoted_at: stick.promoted_at,
          promoted_by: stick.promoted_by,
          workflow_owner: stick.owner_uid
            ? {
                id: stick.owner_uid,
                full_name: stick.owner_name,
                email: stick.owner_email,
                avatar_url: stick.owner_avatar,
              }
            : null,
          calstick,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/social-sticks/[stickId]/workflow - Update workflow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const body = await request.json()
    const { status, ownerId, dueDate } = body

    // Build update
    const updates: string[] = ['workflow_updated_at = NOW()']
    const values: any[] = []
    let paramCount = 0

    if (status !== undefined) {
      paramCount++
      updates.push(`workflow_status = $${paramCount}`)
      values.push(status)
    }
    if (ownerId !== undefined) {
      paramCount++
      updates.push(`workflow_owner_id = $${paramCount}`)
      values.push(ownerId)
    }
    if (dueDate !== undefined) {
      paramCount++
      updates.push(`workflow_due_date = $${paramCount}`)
      values.push(dueDate)
    }

    paramCount++
    values.push(stickId)
    paramCount++
    values.push(orgContext.orgId)

    const updateResult = await db.query(
      `UPDATE social_sticks
       SET ${updates.join(', ')}
       WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
       RETURNING id, workflow_status, workflow_owner_id, workflow_due_date, workflow_updated_at, calstick_id`,
      values
    )

    if (updateResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = updateResult.rows[0]

    // Sync with linked CalStick if status changed
    if (stick.calstick_id && status) {
      const calstickStatus = mapWorkflowToCalstickStatus(status)
      await db.query(
        `UPDATE paks_pad_stick_replies
         SET calstick_status = $1,
             calstick_completed = $2,
             calstick_completed_at = $3
         WHERE id = $4`,
        [calstickStatus, status === 'resolved', status === 'resolved' ? new Date().toISOString() : null, stick.calstick_id]
      )
    }

    return new Response(JSON.stringify({ workflow: stick }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

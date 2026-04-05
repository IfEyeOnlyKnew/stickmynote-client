// v2 Calsticks Budget API: production-quality, manage project budgets
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/budget - Get project budget data
export async function GET(request: NextRequest) {
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
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Get calstick replies with dates
    const repliesResult = await db.query(
      `SELECT DISTINCT stick_id FROM paks_pad_stick_replies
       WHERE is_calstick = true AND org_id = $1 AND calstick_date IS NOT NULL`,
      [orgContext.orgId]
    )

    const stickIds = repliesResult.rows.map((r: any) => r.stick_id)

    if (stickIds.length === 0) {
      return new Response(JSON.stringify({ projects: [] }), { status: 200 })
    }

    // Get sticks and their pads
    const sticksResult = await db.query(
      `SELECT DISTINCT pad_id FROM paks_pad_sticks WHERE id = ANY($1) AND org_id = $2`,
      [stickIds, orgContext.orgId]
    )

    const padIdsWithCalSticks = sticksResult.rows.map((s: any) => s.pad_id).filter(Boolean)

    if (padIdsWithCalSticks.length === 0) {
      return new Response(JSON.stringify({ projects: [] }), { status: 200 })
    }

    // Get pads the user has access to
    const padsResult = await db.query(
      `SELECT id, name, budget_cents, hourly_rate_cents, is_billable
       FROM paks_pads
       WHERE id = ANY($1) AND org_id = $2
       AND (owner_id = $3 OR id IN (SELECT pad_id FROM paks_pad_members WHERE user_id = $3 AND org_id = $2))`,
      [padIdsWithCalSticks, orgContext.orgId, user.id]
    )

    const pads = padsResult.rows
    const padIds = pads.map((p: any) => p.id)

    // Get tasks for these pads
    const tasksResult = await db.query(
      `SELECT r.id, r.content, r.stick_id, r.calstick_estimated_hours,
              r.calstick_actual_hours, r.calstick_assignee_id, r.calstick_status, s.pad_id
       FROM paks_pad_stick_replies r
       JOIN paks_pad_sticks s ON r.stick_id = s.id
       WHERE r.is_calstick = true AND r.org_id = $1 AND r.calstick_date IS NOT NULL
       AND s.pad_id = ANY($2)`,
      [orgContext.orgId, padIds]
    )

    // Get assignee info
    const assigneeIds = [...new Set(tasksResult.rows.map((t: any) => t.calstick_assignee_id).filter(Boolean))]
    let userMap = new Map()
    if (assigneeIds.length > 0) {
      const usersResult = await db.query(
        `SELECT id, full_name, email, hourly_rate_cents FROM users WHERE id = ANY($1)`,
        [assigneeIds]
      )
      userMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))
    }

    // Build project data
    const projects = pads.map((pad: any) => {
      const padTasks = tasksResult.rows
        .filter((t: any) => t.pad_id === pad.id)
        .map((task: any) => {
          const assignee = task.calstick_assignee_id ? userMap.get(task.calstick_assignee_id) : null
          const assigneeRate = assignee?.hourly_rate_cents || pad.hourly_rate_cents || 0

          return {
            id: task.id,
            content: task.content,
            estimatedHours: task.calstick_estimated_hours || 0,
            actualHours: task.calstick_actual_hours || 0,
            assigneeId: task.calstick_assignee_id,
            assigneeName: assignee?.full_name || assignee?.email || null,
            assigneeRate,
            status: task.calstick_status || 'todo',
          }
        })

      const totalEstimatedCost = padTasks.reduce((sum: number, t: any) => sum + t.estimatedHours * t.assigneeRate, 0)
      const totalActualCost = padTasks.reduce((sum: number, t: any) => sum + t.actualHours * t.assigneeRate, 0)
      const budgetCents = pad.budget_cents || 0
      const remainingBudget = budgetCents - totalActualCost
      const percentSpent = budgetCents > 0 ? (totalActualCost / budgetCents) * 100 : 0

      return {
        padId: pad.id,
        padName: pad.name,
        budgetCents,
        hourlyRateCents: pad.hourly_rate_cents || 0,
        isBillable: pad.is_billable || false,
        tasks: padTasks,
        totalEstimatedCost,
        totalActualCost,
        remainingBudget,
        percentSpent: Math.min(percentSpent, 100),
      }
    })

    return new Response(JSON.stringify({ projects }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/budget - Update project budget
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { padId, budgetCents, hourlyRateCents, isBillable } = body

    await db.query(
      `UPDATE paks_pads SET budget_cents = $1, hourly_rate_cents = $2, is_billable = $3
       WHERE id = $4 AND org_id = $5`,
      [budgetCents, hourlyRateCents, isBillable, padId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Calsticks Workload API: production-quality, get team workload data
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/workload - Get team workload data
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    // Get all users with capacity settings
    const usersResult = await db.query(
      `SELECT id, full_name, email, hourly_rate_cents, COALESCE(capacity_hours_per_day, 8) as capacity_hours_per_day
       FROM users`
    )

    // Build tasks query
    let tasksQuery = `
      SELECT id, content, calstick_assignee_id, calstick_estimated_hours,
             calstick_actual_hours, calstick_date, calstick_status, calstick_priority
      FROM paks_pad_stick_replies
      WHERE is_calstick = true AND calstick_assignee_id IS NOT NULL
    `
    const params: any[] = []

    if (start) {
      params.push(start)
      tasksQuery += ` AND calstick_date >= $${params.length}`
    }
    if (end) {
      params.push(end)
      tasksQuery += ` AND calstick_date <= $${params.length}`
    }

    const tasksResult = await db.query(tasksQuery, params)

    // Group tasks by user
    const workloadData = usersResult.rows.map((user: any) => ({
      userId: user.id,
      userName: user.full_name || user.email,
      email: user.email,
      capacityHoursPerDay: user.capacity_hours_per_day || 8.0,
      hourlyRateCents: user.hourly_rate_cents || 0,
      tasks: tasksResult.rows
        .filter((task: any) => task.calstick_assignee_id === user.id)
        .map((task: any) => ({
          id: task.id,
          content: task.content,
          estimatedHours: task.calstick_estimated_hours || 0,
          actualHours: task.calstick_actual_hours || 0,
          dueDate: task.calstick_date,
          status: task.calstick_status || 'todo',
          priority: task.calstick_priority || 'none',
        })),
    }))

    return new Response(JSON.stringify({ users: workloadData }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Calsticks Portfolio Metrics API: production-quality, get portfolio analytics
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/portfolio/metrics - Get portfolio metrics
export async function GET() {
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

    // Fetch all calsticks for the user
    const result = await db.query(
      `SELECT * FROM paks_pad_stick_replies
       WHERE user_id = $1 AND is_calstick = true`,
      [user.id]
    )

    const tasks = result.rows
    const now = new Date()

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.calstick_completed).length
    const inProgressTasks = tasks.filter(
      (t) => !t.calstick_completed && t.calstick_status === 'in_progress'
    ).length
    const overdueTasks = tasks.filter(
      (t) => !t.calstick_completed && t.calstick_date && new Date(t.calstick_date) < now
    ).length

    // Budget calculations
    const totalBudget = 0
    const spentBudget = tasks.reduce((sum, t) => {
      const hours = t.calstick_actual_hours || 0
      const rate = 0
      return sum + hours * rate
    }, 0)

    // Time calculations
    const totalEstimatedHours = tasks.reduce(
      (sum, t) => sum + (t.calstick_estimated_hours || 0),
      0
    )
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.calstick_actual_hours || 0), 0)

    // Team capacity (assuming 40 hours per week per user, adjust as needed)
    const teamCapacity = 160 // 4 weeks * 40 hours
    const teamUtilization = Math.round((totalActualHours / teamCapacity) * 100)

    // Completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Velocity trend (last 8 weeks)
    const velocityTrend: { week: string; completed: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const completed = tasks.filter((t) => {
        if (!t.calstick_completed || !t.updated_at) return false
        const updatedDate = new Date(t.updated_at)
        return updatedDate >= weekStart && updatedDate < weekEnd
      }).length

      velocityTrend.push({
        week: `Week ${8 - i}`,
        completed,
      })
    }

    // Status distribution
    const statusCounts = {
      todo: tasks.filter((t) => t.calstick_status === 'todo').length,
      in_progress: tasks.filter((t) => t.calstick_status === 'in_progress').length,
      in_review: tasks.filter(
        (t) => t.calstick_status === 'in_review' || t.calstick_status === 'review'
      ).length,
      done: tasks.filter((t) => t.calstick_status === 'done').length,
      cancelled: tasks.filter(
        (t) => t.calstick_status === 'cancelled' || t.calstick_status === 'canceled'
      ).length,
    }

    const statusDistribution = [
      { name: 'To Do', value: statusCounts.todo, color: '#94a3b8' },
      { name: 'In Progress', value: statusCounts.in_progress, color: '#3b82f6' },
      { name: 'In Review', value: statusCounts.in_review, color: '#f59e0b' },
      { name: 'Done', value: statusCounts.done, color: '#22c55e' },
      { name: 'Cancelled', value: statusCounts.cancelled, color: '#ef4444' },
    ].filter((s) => s.value > 0)

    // Priority distribution
    const priorityDistribution = [
      { name: 'Urgent', value: tasks.filter((t) => t.calstick_priority === 'urgent').length },
      { name: 'High', value: tasks.filter((t) => t.calstick_priority === 'high').length },
      { name: 'Medium', value: tasks.filter((t) => t.calstick_priority === 'medium').length },
      { name: 'Low', value: tasks.filter((t) => t.calstick_priority === 'low').length },
    ].filter((p) => p.value > 0)

    return new Response(
      JSON.stringify({
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        totalBudget,
        spentBudget,
        totalEstimatedHours,
        totalActualHours,
        teamCapacity,
        teamUtilization,
        completionRate,
        velocityTrend,
        statusDistribution,
        priorityDistribution,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

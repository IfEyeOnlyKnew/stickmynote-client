import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    // Fetch all calsticks for the user
    const { data: tasks, error: tasksError } = await db
      .from("paks_pad_stick_replies")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_calstick", true)

    if (tasksError) throw tasksError

    const now = new Date()
    const totalTasks = tasks?.length || 0
    const completedTasks = tasks?.filter((t) => t.calstick_completed).length || 0
    const inProgressTasks =
      tasks?.filter((t) => !t.calstick_completed && t.calstick_status === "in_progress").length || 0
    const overdueTasks =
      tasks?.filter((t) => !t.calstick_completed && t.calstick_date && new Date(t.calstick_date) < now).length || 0

    // Budget calculations
    const totalBudget = 0 // tasks?.reduce((sum, t) => sum + (t.budget || 0), 0) || 0
    const spentBudget =
      tasks?.reduce((sum, t) => {
        const hours = t.calstick_actual_hours || 0
        const rate = 0 // t.hourly_rate || 0
        return sum + hours * rate
      }, 0) || 0

    // Time calculations
    const totalEstimatedHours = tasks?.reduce((sum, t) => sum + (t.calstick_estimated_hours || 0), 0) || 0
    const totalActualHours = tasks?.reduce((sum, t) => sum + (t.calstick_actual_hours || 0), 0) || 0

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

      const completed =
        tasks?.filter((t) => {
          if (!t.calstick_completed || !t.updated_at) return false
          const updatedDate = new Date(t.updated_at)
          return updatedDate >= weekStart && updatedDate < weekEnd
        }).length || 0

      velocityTrend.push({
        week: `Week ${8 - i}`,
        completed,
      })
    }

    // Status distribution
    const statusCounts = {
      todo: tasks?.filter((t) => t.calstick_status === "todo").length || 0,
      in_progress: tasks?.filter((t) => t.calstick_status === "in_progress").length || 0,
      in_review: tasks?.filter((t) => t.calstick_status === "in_review" || t.calstick_status === "review").length || 0,
      done: tasks?.filter((t) => t.calstick_status === "done").length || 0,
      cancelled:
        tasks?.filter((t) => t.calstick_status === "cancelled" || t.calstick_status === "canceled").length || 0,
    }

    const statusDistribution = [
      { name: "To Do", value: statusCounts.todo, color: "#94a3b8" },
      { name: "In Progress", value: statusCounts.in_progress, color: "#3b82f6" },
      { name: "In Review", value: statusCounts.in_review, color: "#f59e0b" },
      { name: "Done", value: statusCounts.done, color: "#22c55e" },
      { name: "Cancelled", value: statusCounts.cancelled, color: "#ef4444" },
    ].filter((s) => s.value > 0)

    // Priority distribution
    const priorityDistribution = [
      { name: "Urgent", value: tasks?.filter((t) => t.calstick_priority === "urgent").length || 0 },
      { name: "High", value: tasks?.filter((t) => t.calstick_priority === "high").length || 0 },
      { name: "Medium", value: tasks?.filter((t) => t.calstick_priority === "medium").length || 0 },
      { name: "Low", value: tasks?.filter((t) => t.calstick_priority === "low").length || 0 },
    ].filter((p) => p.value > 0)

    // On-time delivery rate
    const completedWithDates = tasks?.filter((t) => t.calstick_completed && t.calstick_date) || []
    const onTimeCount = completedWithDates.filter((t) => {
      const completed = new Date(t.updated_at)
      const due = new Date(t.calstick_date)
      return completed <= due
    }).length
    const onTimeRate = completedWithDates.length > 0
      ? Math.round((onTimeCount / completedWithDates.length) * 100) : 100

    // Budget adherence
    const budgetAdherence = totalEstimatedHours > 0
      ? Math.max(0, 100 - Math.abs(((totalActualHours - totalEstimatedHours) / totalEstimatedHours) * 100))
      : 100

    // Health score: completion(30%) + on-time(25%) + budget(20%) + utilization balance(25%)
    const utilBalance = Math.max(0, 100 - Math.abs(teamUtilization - 75))
    const healthScore = Math.round(
      completionRate * 0.3 + onTimeRate * 0.25 + budgetAdherence * 0.2 + utilBalance * 0.25
    )
    const ragStatus = healthScore >= 75 ? "green" : healthScore >= 50 ? "amber" : "red"

    // Auto-detected risks
    const risks: Array<{ type: string; message: string; severity: string }> = []
    if (overdueTasks > 0) {
      risks.push({ type: "overdue", message: `${overdueTasks} task${overdueTasks > 1 ? "s" : ""} overdue`, severity: overdueTasks > 5 ? "high" : "medium" })
    }
    if (teamUtilization > 100) {
      risks.push({ type: "overloaded", message: `Team utilization at ${teamUtilization}%`, severity: "high" })
    }
    if (onTimeRate < 70) {
      risks.push({ type: "delivery", message: `Only ${onTimeRate}% tasks delivered on time`, severity: "high" })
    }
    if (completionRate < 30 && totalTasks > 5) {
      risks.push({ type: "progress", message: `Low completion rate (${completionRate}%)`, severity: "medium" })
    }

    // Project breakdown — group by pad
    const padMap = new Map<string, { name: string; total: number; completed: number; overdue: number }>()
    for (const t of tasks || []) {
      const padId = t.social_pad_id || "unassigned"
      if (!padMap.has(padId)) {
        padMap.set(padId, { name: padId === "unassigned" ? "Unassigned" : `Project ${padId.slice(0, 8)}`, total: 0, completed: 0, overdue: 0 })
      }
      const entry = padMap.get(padId)!
      entry.total++
      if (t.calstick_completed) entry.completed++
      if (!t.calstick_completed && t.calstick_date && new Date(t.calstick_date) < now) entry.overdue++
    }
    const projectBreakdown = Array.from(padMap.values()).map((p) => {
      const pctComplete = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
      return {
        ...p,
        completionRate: pctComplete,
        ragStatus: p.overdue > 3 ? "red" : p.overdue > 0 ? "amber" : "green",
      }
    }).sort((a, b) => b.total - a.total)

    return NextResponse.json({
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
      healthScore,
      ragStatus,
      onTimeRate,
      risks,
      projectBreakdown,
    })
  } catch (error) {
    console.error("Error fetching portfolio metrics:", error)
    return NextResponse.json({ error: "Failed to fetch portfolio metrics" }, { status: 500 })
  }
}

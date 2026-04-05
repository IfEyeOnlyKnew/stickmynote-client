import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { NextResponse } from "next/server"

function countByFilter(tasks: any[], predicate: (t: any) => boolean): number {
  return tasks.filter(predicate).length
}

function computeVelocityTrend(tasks: any[], now: Date) {
  const trend: { week: string; completed: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const completed = countByFilter(tasks, (t) => {
      if (!t.calstick_completed || !t.updated_at) return false
      const updatedDate = new Date(t.updated_at)
      return updatedDate >= weekStart && updatedDate < weekEnd
    })

    trend.push({ week: `Week ${8 - i}`, completed })
  }
  return trend
}

function computeStatusDistribution(tasks: any[]) {
  const statusMap: Record<string, { name: string; color: string; statuses: string[] }> = {
    todo: { name: "To Do", color: "#94a3b8", statuses: ["todo"] },
    in_progress: { name: "In Progress", color: "#3b82f6", statuses: ["in_progress"] },
    in_review: { name: "In Review", color: "#f59e0b", statuses: ["in_review", "review"] },
    done: { name: "Done", color: "#22c55e", statuses: ["done"] },
    cancelled: { name: "Cancelled", color: "#ef4444", statuses: ["cancelled", "canceled"] },
  }

  return Object.values(statusMap)
    .map((entry) => ({
      name: entry.name,
      value: countByFilter(tasks, (t) => entry.statuses.includes(t.calstick_status)),
      color: entry.color,
    }))
    .filter((s) => s.value > 0)
}

function computeRisks(overdueTasks: number, teamUtilization: number, onTimeRate: number, completionRate: number, totalTasks: number) {
  const risks: Array<{ type: string; message: string; severity: string }> = []
  if (overdueTasks > 0) risks.push({ type: "overdue", message: `${overdueTasks} task${overdueTasks > 1 ? "s" : ""} overdue`, severity: overdueTasks > 5 ? "high" : "medium" })
  if (teamUtilization > 100) risks.push({ type: "overloaded", message: `Team utilization at ${teamUtilization}%`, severity: "high" })
  if (onTimeRate < 70) risks.push({ type: "delivery", message: `Only ${onTimeRate}% tasks delivered on time`, severity: "high" })
  if (completionRate < 30 && totalTasks > 5) risks.push({ type: "progress", message: `Low completion rate (${completionRate}%)`, severity: "medium" })
  return risks
}

function computeProjectBreakdown(tasks: any[], now: Date) {
  const padMap = new Map<string, { name: string; total: number; completed: number; overdue: number }>()
  for (const t of tasks) {
    const padId = t.social_pad_id || "unassigned"
    if (!padMap.has(padId)) {
      padMap.set(padId, { name: padId === "unassigned" ? "Unassigned" : `Project ${padId.slice(0, 8)}`, total: 0, completed: 0, overdue: 0 })
    }
    const entry = padMap.get(padId)!
    entry.total++
    if (t.calstick_completed) entry.completed++
    if (!t.calstick_completed && t.calstick_date && new Date(t.calstick_date) < now) entry.overdue++
  }

  return Array.from(padMap.values())
    .map((p) => {
      const pctComplete = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
      const rag = p.overdue > 3 ? "red" : p.overdue > 0 ? "amber" : "green"
      return { ...p, completionRate: pctComplete, ragStatus: rag }
    })
    .sort((a, b) => b.total - a.total)
}

function computePortfolioMetrics(tasks: any[]) {
  const now = new Date()
  const totalTasks = tasks.length
  const completedTasks = countByFilter(tasks, (t) => t.calstick_completed)
  const inProgressTasks = countByFilter(tasks, (t) => !t.calstick_completed && t.calstick_status === "in_progress")
  const overdueTasks = countByFilter(tasks, (t) => !t.calstick_completed && t.calstick_date && new Date(t.calstick_date) < now)

  const totalBudget = 0
  const spentBudget = tasks.reduce((sum, t) => sum + (t.calstick_actual_hours || 0) * 0, 0)
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.calstick_estimated_hours || 0), 0)
  const totalActualHours = tasks.reduce((sum, t) => sum + (t.calstick_actual_hours || 0), 0)

  const teamCapacity = 160
  const teamUtilization = Math.round((totalActualHours / teamCapacity) * 100)
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const completedWithDates = tasks.filter((t) => t.calstick_completed && t.calstick_date)
  const onTimeCount = countByFilter(completedWithDates, (t) => new Date(t.updated_at) <= new Date(t.calstick_date))
  const onTimeRate = completedWithDates.length > 0 ? Math.round((onTimeCount / completedWithDates.length) * 100) : 100

  const budgetAdherence = totalEstimatedHours > 0
    ? Math.max(0, 100 - Math.abs(((totalActualHours - totalEstimatedHours) / totalEstimatedHours) * 100))
    : 100

  const utilBalance = Math.max(0, 100 - Math.abs(teamUtilization - 75))
  const healthScore = Math.round(completionRate * 0.3 + onTimeRate * 0.25 + budgetAdherence * 0.2 + utilBalance * 0.25)
  const ragStatus = healthScore >= 75 ? "green" : healthScore >= 50 ? "amber" : "red"

  const priorityDistribution = ["urgent", "high", "medium", "low"]
    .map((p) => ({ name: p.charAt(0).toUpperCase() + p.slice(1), value: countByFilter(tasks, (t) => t.calstick_priority === p) }))
    .filter((p) => p.value > 0)

  return {
    totalTasks, completedTasks, inProgressTasks, overdueTasks,
    totalBudget, spentBudget, totalEstimatedHours, totalActualHours,
    teamCapacity, teamUtilization, completionRate,
    velocityTrend: computeVelocityTrend(tasks, now),
    statusDistribution: computeStatusDistribution(tasks),
    priorityDistribution, healthScore, ragStatus, onTimeRate,
    risks: computeRisks(overdueTasks, teamUtilization, onTimeRate, completionRate, totalTasks),
    projectBreakdown: computeProjectBreakdown(tasks, now),
  }
}

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

    const metrics = computePortfolioMetrics(tasks || [])
    return NextResponse.json(metrics)
  } catch (error) {
    console.error("Error fetching portfolio metrics:", error)
    return NextResponse.json({ error: "Failed to fetch portfolio metrics" }, { status: 500 })
  }
}

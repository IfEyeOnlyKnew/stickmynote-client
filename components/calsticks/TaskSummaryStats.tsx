"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  BarChart3,
  ListTodo,
  Diamond,
} from "lucide-react"
import type { CalStick } from "@/types/calstick"

interface TaskSummaryStatsProps {
  readonly calsticks: CalStick[]
}

export function TaskSummaryStats({ calsticks }: TaskSummaryStatsProps) {
  const stats = useMemo(() => {
    const total = calsticks.length
    const completed = calsticks.filter((cs) => cs.calstick_completed).length
    const inProgress = calsticks.filter((cs) => cs.calstick_status === "in-progress").length
    const inReview = calsticks.filter((cs) => cs.calstick_status === "in-review").length
    const blocked = calsticks.filter((cs) => cs.calstick_status === "blocked").length
    const unassigned = calsticks.filter((cs) => !cs.calstick_assignee_id && !cs.calstick_completed).length
    const milestones = calsticks.filter((cs) => cs.calstick_is_milestone).length

    const now = new Date()
    const overdue = calsticks.filter((cs) => {
      if (cs.calstick_completed) return false
      if (!cs.calstick_date) return false
      return new Date(cs.calstick_date) < now
    }).length

    const byPriority = {
      urgent: calsticks.filter((cs) => cs.calstick_priority === "urgent" && !cs.calstick_completed).length,
      high: calsticks.filter((cs) => cs.calstick_priority === "high" && !cs.calstick_completed).length,
      medium: calsticks.filter((cs) => cs.calstick_priority === "medium" && !cs.calstick_completed).length,
      low: calsticks.filter((cs) => cs.calstick_priority === "low" && !cs.calstick_completed).length,
    }

    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, inProgress, inReview, blocked, unassigned, overdue, milestones, byPriority, completionPercent }
  }, [calsticks])

  return (
    <div className="mb-6 space-y-3">
      {/* Main stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Tasks */}
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-md bg-blue-100 dark:bg-blue-950 p-2">
              <ListTodo className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-md bg-green-100 dark:bg-green-950 p-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.completed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Done</p>
            </div>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-md bg-yellow-100 dark:bg-yellow-950 p-2">
              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
            </div>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`rounded-md p-2 ${stats.overdue > 0 ? "bg-red-100 dark:bg-red-950" : "bg-muted"}`}>
              <AlertTriangle className={`h-4 w-4 ${stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold leading-none ${stats.overdue > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {stats.overdue}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
            </div>
          </CardContent>
        </Card>

        {/* Unassigned */}
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`rounded-md p-2 ${stats.unassigned > 0 ? "bg-orange-100 dark:bg-orange-950" : "bg-muted"}`}>
              <UserX className={`h-4 w-4 ${stats.unassigned > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.unassigned}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Unassigned</p>
            </div>
          </CardContent>
        </Card>

        {/* Blocked */}
        {stats.blocked > 0 && (
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-md bg-red-100 dark:bg-red-950 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none text-red-600 dark:text-red-400">{stats.blocked}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Blocked</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {stats.milestones > 0 && (
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-md bg-purple-100 dark:bg-purple-950 p-2">
                <Diamond className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{stats.milestones}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Milestones</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completion bar + priority breakdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Progress value={stats.completionPercent} className="h-2 flex-1" />
          <span className="text-sm font-medium tabular-nums shrink-0">{stats.completionPercent}%</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {stats.byPriority.urgent > 0 && (
            <Badge variant="destructive" className="text-xs">
              {stats.byPriority.urgent} urgent
            </Badge>
          )}
          {stats.byPriority.high > 0 && (
            <Badge className="text-xs bg-orange-500 hover:bg-orange-600">
              {stats.byPriority.high} high
            </Badge>
          )}
          {stats.byPriority.medium > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stats.byPriority.medium} medium
            </Badge>
          )}
          {stats.byPriority.low > 0 && (
            <Badge variant="outline" className="text-xs">
              {stats.byPriority.low} low
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

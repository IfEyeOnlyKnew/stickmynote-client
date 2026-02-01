"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Target, Calendar } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { format, parseISO, isBefore } from "date-fns"
import type { SprintBurndownData } from "@/types/sprint"

interface BurnupChartProps {
  readonly sprintId: string
  readonly className?: string
}

// Helper to get actual completed points for a date
function getActualCompletedPoints(
  snapshot: { completed_points: number } | undefined,
  isPastOrToday: boolean,
  fallbackPoints: number
): number | null {
  if (snapshot) return snapshot.completed_points
  if (isPastOrToday) return fallbackPoints
  return null
}

export function BurnupChart({ sprintId, className }: BurnupChartProps) {
  const [data, setData] = useState<SprintBurndownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBurndown = async () => {
      try {
        setLoading(true)
        setError(null)
        // Use the same burndown endpoint - we'll transform the data for burnup
        const response = await fetch(`/api/calsticks/sprints/${sprintId}/burndown`)

        if (!response.ok) {
          throw new Error("Failed to fetch burnup data")
        }

        const burndownData = await response.json()
        setData(burndownData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load burnup")
      } finally {
        setLoading(false)
      }
    }

    if (sprintId) {
      fetchBurndown()
    }
  }, [sprintId])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          {error || "No burnup data available"}
        </CardContent>
      </Card>
    )
  }

  const { sprint, snapshots, idealBurndown, currentProgress } = data

  // Transform data for burnup chart (showing cumulative completed work)
  const chartData = idealBurndown.map((ideal) => {
    const snapshot = snapshots.find((s) => s.snapshot_date === ideal.date)
    const today = format(new Date(), "yyyy-MM-dd")
    const isToday = ideal.date === today
    const isPast = isBefore(parseISO(ideal.date), new Date())

    // Calculate ideal completion (linear progression to total points)
    const totalDays = idealBurndown.length - 1
    const dayIndex = idealBurndown.findIndex((i) => i.date === ideal.date)
    const idealCompleted = totalDays > 0
      ? Math.round((dayIndex / totalDays) * currentProgress.totalPoints * 10) / 10
      : 0

    return {
      date: ideal.date,
      displayDate: format(parseISO(ideal.date), "MMM d"),
      scope: currentProgress.totalPoints, // Total scope line (flat)
      idealCompleted, // Ideal completion line (linear growth)
      actualCompleted: getActualCompletedPoints(snapshot, isPast || isToday, currentProgress.completedPoints),
    }
  })

  const getStatusColor = () => {
    const { percentComplete } = currentProgress
    if (percentComplete >= 90) return "text-green-500"
    if (percentComplete >= 50) return "text-yellow-500"
    return "text-orange-500"
  }

  const getProgressStatus = () => {
    const { completedPoints, totalPoints, percentComplete } = currentProgress
    // Compare actual vs ideal at this point
    const currentDayIndex = chartData.findIndex((d) => d.date === format(new Date(), "yyyy-MM-dd"))
    const idealAtThisPoint = currentDayIndex >= 0
      ? chartData[currentDayIndex]?.idealCompleted || 0
      : (percentComplete / 100) * totalPoints

    if (completedPoints >= idealAtThisPoint) {
      return { status: "ahead", color: "text-green-500", label: "Ahead of schedule" }
    } else if (completedPoints >= idealAtThisPoint * 0.8) {
      return { status: "on-track", color: "text-blue-500", label: "On track" }
    } else {
      return { status: "behind", color: "text-orange-500", label: "Behind schedule" }
    }
  }

  const progressStatus = getProgressStatus()

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sprint Burnup
            </CardTitle>
            <CardDescription>{sprint.name}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={sprint.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {sprint.status}
            </Badge>
            <Badge variant="outline" className={progressStatus.color}>
              {progressStatus.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{currentProgress.totalPoints}</div>
            <div className="text-xs text-muted-foreground">Total Scope</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>
              {currentProgress.completedPoints}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {currentProgress.percentComplete}%
            </div>
            <div className="text-xs text-muted-foreground">Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {currentProgress.daysRemaining}
            </div>
            <div className="text-xs text-muted-foreground">Days Left</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Completion Progress</span>
            <span className="font-medium">
              {currentProgress.completedPoints} / {currentProgress.totalPoints} points
            </span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
            {/* Scope bar (background) */}
            <div className="absolute inset-0 bg-muted-foreground/10" />
            {/* Completed bar */}
            <div
              className="h-full bg-primary transition-all duration-500 relative"
              style={{ width: `${currentProgress.percentComplete}%` }}
            />
          </div>
        </div>

        {/* Burnup Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                label={{
                  value: "Story Points",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    scope: "Total Scope",
                    idealCompleted: "Ideal Progress",
                    actualCompleted: "Actual Progress",
                  }
                  return [`${value} points`, labels[name] || name]
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <ReferenceLine
                x={format(new Date(), "MMM d")}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{ value: "Today", position: "top", fontSize: 10 }}
              />
              {/* Total Scope Line */}
              <Area
                type="monotone"
                dataKey="scope"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                fill="hsl(var(--muted-foreground) / 0.1)"
                strokeDasharray="5 5"
                name="scope"
                dot={false}
              />
              {/* Ideal Progress Line */}
              <Area
                type="linear"
                dataKey="idealCompleted"
                stroke="hsl(var(--muted-foreground) / 0.5)"
                strokeWidth={1}
                fill="none"
                strokeDasharray="3 3"
                name="idealCompleted"
                dot={false}
              />
              {/* Actual Progress Area */}
              <Area
                type="monotone"
                dataKey="actualCompleted"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="hsl(var(--primary) / 0.2)"
                name="actualCompleted"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend explanation */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-muted-foreground/30" style={{ borderStyle: "dashed" }} />
            <span>Total Scope</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-muted-foreground/50" style={{ borderStyle: "dashed" }} />
            <span>Ideal Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-primary" />
            <span>Actual Progress</span>
          </div>
        </div>

        {/* Sprint Info */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(parseISO(sprint.start_date), "MMM d")} - {format(parseISO(sprint.end_date), "MMM d, yyyy")}
            </span>
          </div>
          {sprint.goal && (
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              <span className="truncate max-w-[200px]">{sprint.goal}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

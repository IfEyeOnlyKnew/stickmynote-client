"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingDown, Target, Calendar } from "lucide-react"
import {
  LineChart,
  Line,
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

interface BurndownChartProps {
  readonly sprintId: string
  readonly className?: string
}

// Helper to get actual remaining points for a date
function getActualRemainingPoints(
  snapshot: { remaining_points: number } | undefined,
  isPastOrToday: boolean,
  fallbackPoints: number
): number | null {
  if (snapshot) return snapshot.remaining_points
  if (isPastOrToday) return fallbackPoints
  return null
}

export function BurndownChart({ sprintId, className }: BurndownChartProps) {
  const [data, setData] = useState<SprintBurndownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBurndown = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/calsticks/sprints/${sprintId}/burndown`)

        if (!response.ok) {
          throw new Error("Failed to fetch burndown data")
        }

        const burndownData = await response.json()
        setData(burndownData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load burndown")
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
          {error || "No burndown data available"}
        </CardContent>
      </Card>
    )
  }

  const { sprint, snapshots, idealBurndown, currentProgress } = data

  // Combine ideal and actual data for the chart
  const chartData = idealBurndown.map((ideal) => {
    const snapshot = snapshots.find((s) => s.snapshot_date === ideal.date)
    const today = format(new Date(), "yyyy-MM-dd")
    const isToday = ideal.date === today
    const isPast = isBefore(parseISO(ideal.date), new Date())

    return {
      date: ideal.date,
      displayDate: format(parseISO(ideal.date), "MMM d"),
      ideal: Math.round(ideal.points * 10) / 10,
      actual: getActualRemainingPoints(snapshot, isPast || isToday, currentProgress.remainingPoints),
      completed: snapshot?.completed_points || (isToday ? currentProgress.completedPoints : null),
    }
  })

  const getStatusColor = () => {
    const { percentComplete } = currentProgress
    if (percentComplete >= 90) return "text-green-500"
    if (percentComplete >= 50) return "text-yellow-500"
    return "text-orange-500"
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Sprint Burndown
            </CardTitle>
            <CardDescription>{sprint.name}</CardDescription>
          </div>
          <Badge
            variant={sprint.status === "active" ? "default" : "secondary"}
            className="capitalize"
          >
            {sprint.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{currentProgress.totalPoints}</div>
            <div className="text-xs text-muted-foreground">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {currentProgress.completedPoints}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>
              {currentProgress.remainingPoints}
            </div>
            <div className="text-xs text-muted-foreground">Remaining</div>
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
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{currentProgress.percentComplete}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${currentProgress.percentComplete}%` }}
            />
          </div>
        </div>

        {/* Burndown Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                formatter={(value: number, name: string) => [
                  `${value} points`,
                  name === "ideal" ? "Ideal" : "Actual",
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <ReferenceLine
                x={format(new Date(), "MMM d")}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{ value: "Today", position: "top", fontSize: 10 }}
              />
              <Line
                type="linear"
                dataKey="ideal"
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                name="Ideal"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="Actual"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
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

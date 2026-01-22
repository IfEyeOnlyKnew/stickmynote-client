"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { VelocityTrend } from "@/types/sprint"

interface VelocityChartProps {
  className?: string
  limit?: number
}

export function VelocityChart({ className, limit = 8 }: VelocityChartProps) {
  const [data, setData] = useState<VelocityTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVelocity = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/calsticks/sprints/velocity?limit=${limit}`)

        if (!response.ok) {
          throw new Error("Failed to fetch velocity data")
        }

        const velocityData = await response.json()
        setData(velocityData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load velocity")
      } finally {
        setLoading(false)
      }
    }

    fetchVelocity()
  }, [limit])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (!data || data.sprints.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Team Velocity
          </CardTitle>
          <CardDescription>Track your team&apos;s sprint velocity over time</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
          Complete some sprints to see your velocity trend
        </CardContent>
      </Card>
    )
  }

  const { sprints, averageVelocity, trend } = data

  const chartData = sprints.map((sprint) => ({
    name: sprint.sprintName.length > 12
      ? sprint.sprintName.substring(0, 12) + "..."
      : sprint.sprintName,
    fullName: sprint.sprintName,
    planned: sprint.plannedPoints,
    completed: sprint.completedPoints,
    commitment: sprint.plannedPoints > 0
      ? Math.round((sprint.completedPoints / sprint.plannedPoints) * 100)
      : 0,
  }))

  const getTrendIcon = () => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "decreasing":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getTrendBadge = () => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      increasing: "default",
      decreasing: "destructive",
      stable: "secondary",
    }
    return (
      <Badge variant={variants[trend]} className="flex items-center gap-1">
        {getTrendIcon()}
        {trend.charAt(0).toUpperCase() + trend.slice(1)}
      </Badge>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Team Velocity
            </CardTitle>
            <CardDescription>Story points completed per sprint</CardDescription>
          </div>
          {getTrendBadge()}
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{sprints.length}</div>
            <div className="text-xs text-muted-foreground">Sprints</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{averageVelocity}</div>
            <div className="text-xs text-muted-foreground">Avg Velocity</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {sprints.length > 0
                ? Math.round(
                    sprints.reduce((sum, s) => {
                      if (s.plannedPoints === 0) return sum
                      return sum + (s.completedPoints / s.plannedPoints) * 100
                    }, 0) / sprints.filter(s => s.plannedPoints > 0).length
                  ) || 0
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Avg Commitment</div>
          </div>
        </div>

        {/* Velocity Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
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
                  name === "planned" ? "Planned" : "Completed",
                ]}
                labelFormatter={(_, payload: any) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullName
                  }
                  return ""
                }}
              />
              <Legend />
              <ReferenceLine
                y={averageVelocity}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{
                  value: `Avg: ${averageVelocity}`,
                  position: "right",
                  fontSize: 10,
                }}
              />
              <Bar
                dataKey="planned"
                fill="hsl(var(--muted-foreground) / 0.3)"
                name="Planned"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="completed"
                fill="hsl(var(--primary))"
                name="Completed"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insight */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {trend === "increasing" && (
              <>Your team&apos;s velocity is <span className="text-green-500 font-medium">improving</span>. Great progress!</>
            )}
            {trend === "decreasing" && (
              <>Your team&apos;s velocity is <span className="text-red-500 font-medium">declining</span>. Consider reviewing blockers.</>
            )}
            {trend === "stable" && (
              <>Your team&apos;s velocity is <span className="font-medium">stable</span>. Consistent performance.</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

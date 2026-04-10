"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Shield,
  Target,
} from "lucide-react"
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface PortfolioMetrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  totalEstimatedHours: number
  totalActualHours: number
  teamUtilization: number
  completionRate: number
  velocityTrend: Array<{ week: string; completed: number }>
  statusDistribution: Array<{ name: string; value: number; color: string }>
  priorityDistribution: Array<{ name: string; value: number }>
  healthScore: number
  ragStatus: string
  onTimeRate: number
  risks: Array<{ type: string; message: string; severity: string }>
  projectBreakdown: Array<{
    name: string
    total: number
    completed: number
    overdue: number
    completionRate: number
    ragStatus: string
  }>
}

const RAG_CONFIG = {
  green: { label: "On Track", bg: "bg-green-500", text: "text-green-700 dark:text-green-300", ring: "ring-green-400" },
  amber: { label: "At Risk", bg: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-400" },
  red: { label: "Critical", bg: "bg-red-500", text: "text-red-700 dark:text-red-300", ring: "ring-red-400" },
}

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
}

export default function PortfolioPage() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/calsticks/portfolio/metrics")
        if (res.ok) {
          const data = await res.json()
          setMetrics(data)
        }
      } catch (error) {
        console.error("[Portfolio] Error:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-6 text-center text-muted-foreground">Unable to load portfolio metrics.</div>
    )
  }

  const rag = RAG_CONFIG[metrics.ragStatus as keyof typeof RAG_CONFIG] || RAG_CONFIG.amber

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Portfolio Dashboard
        </h1>
        <p className="text-muted-foreground">Executive overview of project health and performance</p>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-full ${rag.bg} flex items-center justify-center mb-3 ring-4 ${rag.ring} ring-offset-2`}>
              <span className="text-2xl font-bold text-white">{metrics.healthScore}</span>
            </div>
            <div className={`text-lg font-semibold ${rag.text}`}>{rag.label}</div>
            <div className="text-xs text-muted-foreground mt-1">Health Score</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Completion</span>
              <span className="font-bold">{metrics.completionRate}%</span>
            </div>
            <Progress value={metrics.completionRate} className="h-2" />
            <div className="text-xs text-muted-foreground">{metrics.completedTasks} of {metrics.totalTasks} tasks done</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> On-Time</span>
              <span className="font-bold">{metrics.onTimeRate}%</span>
            </div>
            <Progress value={metrics.onTimeRate} className="h-2" />
            <div className="text-xs text-muted-foreground">{metrics.overdueTasks} task{metrics.overdueTasks === 1 ? "" : "s"} currently overdue</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Hours</span>
              <span className="font-bold">{metrics.totalActualHours.toFixed(0)}h</span>
            </div>
            <Progress value={metrics.totalEstimatedHours > 0 ? Math.min(100, (metrics.totalActualHours / metrics.totalEstimatedHours) * 100) : 0} className="h-2" />
            <div className="text-xs text-muted-foreground">{metrics.totalEstimatedHours.toFixed(0)}h estimated</div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Register */}
      {metrics.risks && metrics.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Risk Register
            </CardTitle>
            <CardDescription>Auto-detected risks based on project data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.risks.map((risk) => (
                <div key={risk.message} className="flex items-center gap-3 p-3 border rounded-lg">
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${{ high: "text-red-500", medium: "text-amber-500", low: "text-blue-500" }[risk.severity] ?? "text-blue-500"}`} />
                  <span className="flex-1 text-sm">{risk.message}</span>
                  <Badge className={SEVERITY_COLORS[risk.severity]} variant="outline">
                    {risk.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Velocity Trend</CardTitle>
            <CardDescription>Tasks completed per week (last 8 weeks)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics.velocityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>Current task status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.statusDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={metrics.statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {metrics.statusDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {metrics.statusDistribution.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}</span>
                      <span className="text-muted-foreground ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No task data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Breakdown */}
      {metrics.projectBreakdown && metrics.projectBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Project Breakdown
            </CardTitle>
            <CardDescription>Per-project status and health indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Project</th>
                    <th className="text-center py-2 px-2 font-medium">RAG</th>
                    <th className="text-center py-2 px-2 font-medium">Tasks</th>
                    <th className="text-center py-2 px-2 font-medium">Completed</th>
                    <th className="text-center py-2 px-2 font-medium">Overdue</th>
                    <th className="py-2 px-2 font-medium w-48">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.projectBreakdown.map((proj) => {
                    const projRag = RAG_CONFIG[proj.ragStatus as keyof typeof RAG_CONFIG] || RAG_CONFIG.amber
                    return (
                      <tr key={proj.name} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="py-2 pr-4 font-medium">{proj.name}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-block w-3 h-3 rounded-full ${projRag.bg}`} title={projRag.label} />
                        </td>
                        <td className="py-2 px-2 text-center">{proj.total}</td>
                        <td className="py-2 px-2 text-center text-green-600">{proj.completed}</td>
                        <td className="py-2 px-2 text-center text-red-600">{proj.overdue > 0 ? proj.overdue : "—"}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Progress value={proj.completionRate} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{proj.completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

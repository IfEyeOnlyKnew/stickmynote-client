"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Target, DollarSign, Users, CheckCircle2, AlertCircle, Plus } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { OKRManager } from "@/components/calsticks/OKRManager"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

interface PortfolioMetrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  totalBudget: number
  spentBudget: number
  totalEstimatedHours: number
  totalActualHours: number
  teamCapacity: number
  teamUtilization: number
  completionRate: number
  velocityTrend: Array<{ week: string; completed: number }>
  statusDistribution: Array<{ name: string; value: number; color: string }>
  priorityDistribution: Array<{ name: string; value: number }>
}

interface Objective {
  id: string
  title: string
  description: string
  status: string
  progress: number
  target_date: string
  key_results: Array<{
    id: string
    title: string
    current_value: number
    target_value: number
    progress: number
    metric_type: string
    unit: string
  }>
}

const STATUS_COLORS = {
  not_started: "#94a3b8",
  on_track: "#22c55e",
  at_risk: "#f59e0b",
  behind: "#ef4444",
  completed: "#3b82f6",
}

export default function PortfolioClient() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [showOKRManager, setShowOKRManager] = useState(false)

  useEffect(() => {
    fetchPortfolioData()
  }, [])

  const fetchPortfolioData = async () => {
    try {
      const [metricsRes, objectivesRes] = await Promise.all([
        fetch("/api/calsticks/portfolio/metrics"),
        fetch("/api/calsticks/objectives"),
      ])

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setMetrics(metricsData)
      }

      if (objectivesRes.ok) {
        const objectivesData = await objectivesRes.json()
        setObjectives(objectivesData)
      }
    } catch (error) {
      console.error("Error fetching portfolio data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Unable to load portfolio data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <BreadcrumbNav
            items={[
              { label: "Alliance Hub", href: "/paks" },
              { label: "CalSticks", href: "/calsticks" },
              { label: "Portfolio", current: true },
            ]}
          />
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Portfolio Dashboard</h1>
              <p className="text-muted-foreground">Enterprise-level insights and OKR tracking</p>
            </div>
          </div>
          <Button onClick={() => setShowOKRManager(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Manage OKRs
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="okrs">OKRs</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.completionRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.completedTasks} of {metrics.totalTasks} tasks
                  </p>
                  <Progress value={metrics.completionRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${metrics.spentBudget.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">of ${metrics.totalBudget.toLocaleString()} budget</p>
                  <Progress value={(metrics.spentBudget / metrics.totalBudget) * 100} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Utilization</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.teamUtilization}%</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.totalActualHours}h of {metrics.teamCapacity}h capacity
                  </p>
                  <Progress value={metrics.teamUtilization} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{metrics.overdueTasks}</div>
                  <p className="text-xs text-muted-foreground">Require immediate attention</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current task status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={metrics.statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {metrics.statusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Priority Distribution</CardTitle>
                  <CardDescription>Tasks by priority level</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.priorityDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="okrs" className="space-y-6">
            {objectives.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Objectives Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first objective to start tracking OKRs
                  </p>
                  <Button onClick={() => setShowOKRManager(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Objective
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {objectives.map((objective) => (
                  <Card key={objective.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle>{objective.title}</CardTitle>
                          <CardDescription>{objective.description}</CardDescription>
                        </div>
                        <Badge
                          style={{
                            backgroundColor: STATUS_COLORS[objective.status as keyof typeof STATUS_COLORS],
                            color: "white",
                          }}
                        >
                          {objective.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Overall Progress</span>
                          <span className="text-sm text-muted-foreground">{objective.progress}%</span>
                        </div>
                        <Progress value={objective.progress} />
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Key Results</h4>
                        {objective.key_results.map((kr) => (
                          <div key={kr.id} className="space-y-2 pl-4 border-l-2 border-muted">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{kr.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {kr.current_value} / {kr.target_value} {kr.unit}
                              </span>
                            </div>
                            <Progress value={kr.progress} className="h-2" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Velocity Trend</CardTitle>
                <CardDescription>Tasks completed per week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.velocityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={2} name="Completed Tasks" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Time Tracking</CardTitle>
                  <CardDescription>Estimated vs Actual Hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Estimated Hours</span>
                        <span className="text-sm font-semibold">{metrics.totalEstimatedHours}h</span>
                      </div>
                      <Progress value={100} className="bg-blue-100" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Actual Hours</span>
                        <span className="text-sm font-semibold">{metrics.totalActualHours}h</span>
                      </div>
                      <Progress
                        value={(metrics.totalActualHours / metrics.totalEstimatedHours) * 100}
                        className="bg-green-100"
                      />
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Variance</span>
                        <span
                          className={`text-sm font-semibold ${
                            metrics.totalActualHours > metrics.totalEstimatedHours
                              ? "text-destructive"
                              : "text-green-600"
                          }`}
                        >
                          {metrics.totalActualHours > metrics.totalEstimatedHours ? "+" : ""}
                          {metrics.totalActualHours - metrics.totalEstimatedHours}h
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Budget Health</CardTitle>
                  <CardDescription>Financial overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Total Budget</span>
                        <span className="text-sm font-semibold">${metrics.totalBudget.toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Spent</span>
                        <span className="text-sm font-semibold">${metrics.spentBudget.toLocaleString()}</span>
                      </div>
                      <Progress
                        value={(metrics.spentBudget / metrics.totalBudget) * 100}
                        className={metrics.spentBudget / metrics.totalBudget > 0.9 ? "bg-red-100" : "bg-green-100"}
                      />
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Remaining</span>
                        <span className="text-sm font-semibold text-green-600">
                          ${(metrics.totalBudget - metrics.spentBudget).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {showOKRManager && (
          <OKRManager
            open={showOKRManager}
            onClose={() => {
              setShowOKRManager(false)
              fetchPortfolioData()
            }}
          />
        )}
      </div>
    </div>
  )
}

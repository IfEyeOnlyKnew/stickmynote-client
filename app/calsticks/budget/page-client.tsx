"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Download } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

interface ProjectBudget {
  padId: string
  padName: string
  budgetCents: number
  hourlyRateCents: number
  isBillable: boolean
  tasks: Array<{
    id: string
    content: string
    estimatedHours: number
    actualHours: number
    assigneeId: string | null
    assigneeName: string | null
    assigneeRate: number
    status: string
  }>
  totalEstimatedCost: number
  totalActualCost: number
  remainingBudget: number
  percentSpent: number
}

export default function BudgetClient() {
  const [projects, setProjects] = useState<ProjectBudget[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [editingProject, setEditingProject] = useState<ProjectBudget | null>(null)

  useEffect(() => {
    fetchBudgetData()
  }, [])

  const fetchBudgetData = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/calsticks/budget")

      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching budget data:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateProjectBudget = async (
    padId: string,
    budgetCents: number,
    hourlyRateCents: number,
    isBillable: boolean,
  ) => {
    try {
      const response = await fetch("/api/calsticks/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padId, budgetCents, hourlyRateCents, isBillable }),
      })

      if (response.ok) {
        await fetchBudgetData()
        setEditingProject(null)
      }
    } catch (error) {
      console.error("[v0] Error updating budget:", error)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const selectedProjectData = projects.find((p) => p.padId === selectedProject)
  const getDisplayProjects = (): ProjectBudget[] => {
    if (selectedProject === "all") return projects
    return selectedProjectData ? [selectedProjectData] : []
  }
  const displayProjects = getDisplayProjects()

  const totalBudget = projects.reduce((sum, p) => sum + p.budgetCents, 0)
  const totalSpent = projects.reduce((sum, p) => sum + p.totalActualCost, 0)
  const totalRemaining = totalBudget - totalSpent

  const costByStatus = selectedProjectData
    ? Object.entries(
        selectedProjectData.tasks.reduce(
          (acc, task) => {
            const status = task.status || "todo"
            const cost = task.actualHours * (task.assigneeRate || selectedProjectData.hourlyRateCents)
            acc[status] = (acc[status] || 0) + cost
            return acc
          },
          {} as Record<string, number>,
        ),
      ).map(([status, cost]) => ({
        status: status.replace("-", " "),
        cost: cost / 100,
      }))
    : []

  const budgetPieData = projects.map((p) => ({
    name: p.padName,
    value: p.totalActualCost / 100,
  }))

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading budget data...</p>
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
              { label: "Budget", current: true },
            ]}
          />
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Budget & Cost Tracking</h1>
            <p className="text-muted-foreground">Monitor project costs and budget utilization</p>
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Project (Pad)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.padId} value={project.padId}>
                    {project.padName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProjectData && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" onClick={() => setEditingProject(selectedProjectData)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Edit Budget
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Budget - {selectedProjectData.padName}</DialogTitle>
                    <DialogDescription>Update budget settings for this project</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="global-budget">Total Budget ($)</Label>
                      <Input
                        id="global-budget"
                        type="number"
                        defaultValue={(selectedProjectData.budgetCents / 100).toFixed(2)}
                        step="0.01"
                        onChange={(e) => {
                          if (editingProject) {
                            setEditingProject({
                              ...editingProject,
                              budgetCents: Math.round(Number.parseFloat(e.target.value) * 100),
                            })
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="global-rate">Hourly Rate ($)</Label>
                      <Input
                        id="global-rate"
                        type="number"
                        defaultValue={(selectedProjectData.hourlyRateCents / 100).toFixed(2)}
                        step="0.01"
                        onChange={(e) => {
                          if (editingProject) {
                            setEditingProject({
                              ...editingProject,
                              hourlyRateCents: Math.round(Number.parseFloat(e.target.value) * 100),
                            })
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (editingProject) {
                          updateProjectBudget(
                            editingProject.padId,
                            editingProject.budgetCents,
                            editingProject.hourlyRateCents,
                            editingProject.isBillable,
                          )
                        }
                      }}
                    >
                      Save Changes
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
              <p className="text-xs text-muted-foreground">
                {totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}% of budget
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRemaining)}</div>
              <p className="text-xs text-muted-foreground">Available budget</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Over Budget</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {projects.filter((p) => p.totalActualCost > p.budgetCents).length}
              </div>
              <p className="text-xs text-muted-foreground">Projects</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget Distribution</CardTitle>
              <CardDescription>Spending by project</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={budgetPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {budgetPieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {selectedProjectData && (
            <Card>
              <CardHeader>
                <CardTitle>Cost by Status</CardTitle>
                <CardDescription>{selectedProjectData.padName}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
                    <Bar dataKey="cost" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Project Details */}
        <div className="space-y-4">
          {displayProjects.map((project) => (
            <Card key={project.padId} className={project.totalActualCost > project.budgetCents ? "border-red-500" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{project.padName}</CardTitle>
                    <CardDescription>
                      {project.isBillable ? "Billable" : "Non-billable"} • Base rate:{" "}
                      {formatCurrency(project.hourlyRateCents)}/hr
                    </CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setEditingProject(project)}>
                        Edit Budget
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Budget - {project.padName}</DialogTitle>
                        <DialogDescription>Update budget settings for this project</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor={`budget-${project.padId}`}>Total Budget ($)</Label>
                          <Input
                            id={`budget-${project.padId}`}
                            type="number"
                            defaultValue={(project.budgetCents / 100).toFixed(2)}
                            step="0.01"
                            onChange={(e) => {
                              setEditingProject({
                                ...project,
                                budgetCents: Math.round(Number.parseFloat(e.target.value) * 100),
                              })
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`rate-${project.padId}`}>Hourly Rate ($)</Label>
                          <Input
                            id={`rate-${project.padId}`}
                            type="number"
                            defaultValue={(project.hourlyRateCents / 100).toFixed(2)}
                            step="0.01"
                            onChange={(e) => {
                              setEditingProject({
                                ...project,
                                hourlyRateCents: Math.round(Number.parseFloat(e.target.value) * 100),
                              })
                            }}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (editingProject) {
                              updateProjectBudget(
                                editingProject.padId,
                                editingProject.budgetCents,
                                editingProject.hourlyRateCents,
                                editingProject.isBillable,
                              )
                            }
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Budget: {formatCurrency(project.budgetCents)}</span>
                    <span>Spent: {formatCurrency(project.totalActualCost)}</span>
                  </div>
                  <Progress value={project.percentSpent} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.percentSpent.toFixed(1)}% used</span>
                    <span className={project.remainingBudget < 0 ? "text-red-500 font-medium" : ""}>
                      {formatCurrency(project.remainingBudget)} remaining
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Task Breakdown ({project.tasks.length} tasks)</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {project.tasks.map((task) => {
                      const taskCost = task.actualHours * (task.assigneeRate || project.hourlyRateCents)
                      return (
                        <div key={task.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{task.content}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.assigneeName || "Unassigned"} • {task.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(taskCost)}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.actualHours}h @ {formatCurrency(task.assigneeRate || project.hourlyRateCents)}/h
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

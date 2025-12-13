"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar, Users, TrendingUp, AlertTriangle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

interface WorkloadData {
  userId: string
  userName: string
  email: string
  capacityHoursPerDay: number
  tasks: Array<{
    id: string
    content: string
    estimatedHours: number
    actualHours: number
    dueDate: string | null
    status: string
    priority: string
  }>
}

interface DailyWorkload {
  date: string
  allocated: number
  capacity: number
  overload: number
}

export default function WorkloadClient() {
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([])
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"week" | "month">("week")

  useEffect(() => {
    fetchWorkloadData()
  }, [currentWeek])

  const fetchWorkloadData = async () => {
    try {
      setLoading(true)
      const weekStart = startOfWeek(currentWeek)
      const weekEnd = endOfWeek(currentWeek)

      const response = await fetch(
        `/api/calsticks/workload?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`,
      )

      if (response.ok) {
        const data = await response.json()
        setWorkloadData(data.users || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching workload data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateDailyWorkload = (user: WorkloadData): DailyWorkload[] => {
    const weekStart = startOfWeek(currentWeek)
    const weekEnd = endOfWeek(currentWeek)
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd")
      const tasksForDay = user.tasks.filter((task) => task.dueDate && isSameDay(new Date(task.dueDate), day))

      const allocated = tasksForDay.reduce((sum, task) => sum + (task.estimatedHours || 0), 0)

      const capacity = user.capacityHoursPerDay
      const overload = Math.max(0, allocated - capacity)

      return {
        date: format(day, "EEE MM/dd"),
        allocated,
        capacity,
        overload,
      }
    })
  }

  const calculateTeamWorkload = (): DailyWorkload[] => {
    const weekStart = startOfWeek(currentWeek)
    const weekEnd = endOfWeek(currentWeek)
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd")

      let totalAllocated = 0
      let totalCapacity = 0

      workloadData.forEach((user) => {
        const tasksForDay = user.tasks.filter((task) => task.dueDate && isSameDay(new Date(task.dueDate), day))

        totalAllocated += tasksForDay.reduce((sum, task) => sum + (task.estimatedHours || 0), 0)
        totalCapacity += user.capacityHoursPerDay
      })

      return {
        date: format(day, "EEE MM/dd"),
        allocated: totalAllocated,
        capacity: totalCapacity,
        overload: Math.max(0, totalAllocated - totalCapacity),
      }
    })
  }

  const getOverloadUsers = () => {
    return workloadData.filter((user) => {
      const dailyWorkload = calculateDailyWorkload(user)
      return dailyWorkload.some((day) => day.overload > 0)
    })
  }

  const selectedUserData = workloadData.find((u) => u.userId === selectedUser)
  const chartData =
    selectedUser === "all" ? calculateTeamWorkload() : selectedUserData ? calculateDailyWorkload(selectedUserData) : []

  const overloadUsers = getOverloadUsers()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workload data...</p>
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
              { label: "Paks-Hub", href: "/paks" },
              { label: "CalSticks", href: "/calsticks" },
              { label: "Workload", current: true },
            ]}
          />
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Resource Workload</h1>
            <p className="text-muted-foreground">Monitor team capacity and identify bottlenecks</p>
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {workloadData.map((user) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {user.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Overload Alerts */}
        {overloadUsers.length > 0 && (
          <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <AlertTriangle className="h-5 w-5" />
                Capacity Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overloadUsers.map((user) => {
                  const dailyWorkload = calculateDailyWorkload(user)
                  const overloadDays = dailyWorkload.filter((d) => d.overload > 0)
                  return (
                    <div key={user.userId} className="flex items-center justify-between">
                      <span className="font-medium">{user.userName}</span>
                      <span className="text-sm text-muted-foreground">
                        Overloaded on {overloadDays.length} day(s) this week
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workloadData.length}</div>
              <p className="text-xs text-muted-foreground">{overloadUsers.length} overloaded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workloadData.reduce((sum, u) => sum + u.capacityHoursPerDay, 0)}h/day
              </div>
              <p className="text-xs text-muted-foreground">Across all team members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workloadData.reduce((sum, u) => sum + u.tasks.length, 0)}</div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>
        </div>

        {/* Workload Chart */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedUser === "all" ? "Team Workload" : `${selectedUserData?.userName}'s Workload`}
            </CardTitle>
            <CardDescription>Week of {format(startOfWeek(currentWeek), "MMM dd, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="capacity" fill="#94a3b8" name="Capacity" />
                <Bar dataKey="allocated" name="Allocated">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.overload > 0 ? "#ef4444" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Details */}
        {selectedUser !== "all" && selectedUserData && (
          <Card>
            <CardHeader>
              <CardTitle>Task Breakdown</CardTitle>
              <CardDescription>{selectedUserData.tasks.length} tasks assigned</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedUserData.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{task.content}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="capitalize">{task.status}</span>
                        <span className="capitalize">{task.priority}</span>
                        {task.dueDate && <span>{format(new Date(task.dueDate), "MMM dd")}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{task.estimatedHours}h estimated</p>
                      <p className="text-sm text-muted-foreground">{task.actualHours}h tracked</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

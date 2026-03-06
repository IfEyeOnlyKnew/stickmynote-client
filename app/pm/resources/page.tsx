"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, TrendingUp, AlertTriangle, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns"

interface WorkloadTask {
  id: string
  content: string
  estimatedHours: number
  actualHours: number
  dueDate: string | null
  status: string
  priority: string
}

interface WorkloadUser {
  userId: string
  userName: string
  email: string
  capacityHoursPerDay: number
  hourlyRateCents: number
  tasks: WorkloadTask[]
}

export default function ResourcesPage() {
  const [users, setUsers] = useState<WorkloadUser[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<string>("utilization")

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const ws = startOfWeek(currentWeek, { weekStartsOn: 1 })
      const we = endOfWeek(currentWeek, { weekStartsOn: 1 })
      const res = await fetch(`/api/calsticks/workload?start=${ws.toISOString()}&end=${we.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("[Resources] Error:", error)
    } finally {
      setLoading(false)
    }
  }, [currentWeek])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function getUserDayHours(user: WorkloadUser, day: Date): number {
    return user.tasks
      .filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day))
      .reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
  }

  function getUserWeekHours(user: WorkloadUser): number {
    return days.reduce((sum, day) => sum + getUserDayHours(user, day), 0)
  }

  function getUserUtilization(user: WorkloadUser): number {
    const weekCapacity = user.capacityHoursPerDay * 5
    if (weekCapacity === 0) return 0
    return (getUserWeekHours(user) / weekCapacity) * 100
  }

  function getUtilColor(pct: number): string {
    if (pct > 100) return "bg-red-500 text-white"
    if (pct >= 80) return "bg-amber-400 text-amber-950"
    if (pct >= 40) return "bg-green-400 text-green-950"
    if (pct > 0) return "bg-green-200 text-green-800"
    return "bg-muted text-muted-foreground"
  }

  function getCellColor(hours: number, capacity: number): string {
    if (hours === 0) return "bg-muted/50"
    const pct = (hours / capacity) * 100
    if (pct > 100) return "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800"
    if (pct >= 80) return "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800"
    return "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800"
  }

  function getStatusBadge(pct: number) {
    if (pct > 100) return <Badge variant="destructive" className="text-xs">Over</Badge>
    if (pct >= 80) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">At Capacity</Badge>
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Available</Badge>
  }

  // Summary calculations
  const totalCapacity = users.reduce((sum, u) => sum + u.capacityHoursPerDay * 5, 0)
  const totalAllocated = users.reduce((sum, u) => sum + getUserWeekHours(u), 0)
  const overallUtilization = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0
  const overloadedCount = users.filter((u) => getUserUtilization(u) > 100).length
  const unallocatedHours = Math.max(0, totalCapacity - totalAllocated)

  // Sorting
  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === "utilization") return getUserUtilization(b) - getUserUtilization(a)
    if (sortBy === "name") return a.userName.localeCompare(b.userName)
    if (sortBy === "tasks") return b.tasks.length - a.tasks.length
    return 0
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Resource Management
          </h1>
          <p className="text-muted-foreground">Team capacity, utilization heatmap, and workload planning</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Team Members</div>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Weekly Capacity</div>
            <div className="text-2xl font-bold">{totalCapacity}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Allocated</div>
            <div className="text-2xl font-bold">{totalAllocated.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Utilization</div>
            <div className={`text-2xl font-bold ${overallUtilization > 100 ? "text-red-600" : overallUtilization >= 80 ? "text-amber-600" : "text-green-600"}`}>
              {overallUtilization.toFixed(0)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Available</div>
            <div className="text-2xl font-bold text-blue-600">{unallocatedHours.toFixed(0)}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Overload Alert */}
      {overloadedCount > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <span className="font-medium text-red-700 dark:text-red-300">
                {overloadedCount} team member{overloadedCount > 1 ? "s" : ""} overloaded
              </span>
              <span className="text-sm text-red-600/70 dark:text-red-400/70 ml-2">
                — consider redistributing tasks
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Utilization Heatmap */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilization Heatmap</CardTitle>
              <CardDescription>Week of {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}</CardDescription>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utilization">Sort by Utilization</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="tasks">Sort by Task Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No team members found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium w-48">Team Member</th>
                    {days.map((day) => (
                      <th key={day.toISOString()} className="text-center py-2 px-1 font-medium w-20">
                        <div>{format(day, "EEE")}</div>
                        <div className="text-xs text-muted-foreground font-normal">{format(day, "M/d")}</div>
                      </th>
                    ))}
                    <th className="text-center py-2 px-2 font-medium w-20">Total</th>
                    <th className="text-center py-2 px-2 font-medium w-20">Util %</th>
                    <th className="text-center py-2 px-2 font-medium w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => {
                    const weekHours = getUserWeekHours(user)
                    const utilPct = getUserUtilization(user)

                    return (
                      <tr key={user.userId} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <div className="font-medium truncate max-w-[180px]">{user.userName}</div>
                          <div className="text-xs text-muted-foreground">{user.capacityHoursPerDay}h/day · {user.tasks.length} tasks</div>
                        </td>
                        {days.map((day) => {
                          const hours = getUserDayHours(user, day)
                          const cap = user.capacityHoursPerDay
                          return (
                            <td key={day.toISOString()} className="py-2 px-1">
                              <div className={`text-center py-1.5 rounded text-xs font-medium border ${getCellColor(hours, cap)}`}>
                                {hours > 0 ? `${hours}h` : "—"}
                              </div>
                            </td>
                          )
                        })}
                        <td className="py-2 px-2 text-center font-medium">
                          {weekHours > 0 ? `${weekHours.toFixed(1)}h` : "—"}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getUtilColor(utilPct)}`}>
                            {utilPct.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {getStatusBadge(utilPct)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-300" /> Under capacity</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300" /> Near capacity</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Over capacity</span>
          </div>
        </CardContent>
      </Card>

      {/* Priority Distribution per User */}
      <Card>
        <CardHeader>
          <CardTitle>Task Priority Breakdown</CardTitle>
          <CardDescription>Distribution of task priorities across team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedUsers.filter((u) => u.tasks.length > 0).map((user) => {
              const urgent = user.tasks.filter((t) => t.priority === "urgent").length
              const high = user.tasks.filter((t) => t.priority === "high").length
              const medium = user.tasks.filter((t) => t.priority === "medium").length
              const low = user.tasks.filter((t) => t.priority === "low" || t.priority === "none").length
              const total = user.tasks.length

              return (
                <div key={user.userId} className="flex items-center gap-4">
                  <div className="w-40 truncate text-sm font-medium">{user.userName}</div>
                  <div className="flex-1 flex h-6 rounded-md overflow-hidden">
                    {urgent > 0 && <div className="bg-red-500" style={{ width: `${(urgent / total) * 100}%` }} title={`${urgent} urgent`} />}
                    {high > 0 && <div className="bg-orange-400" style={{ width: `${(high / total) * 100}%` }} title={`${high} high`} />}
                    {medium > 0 && <div className="bg-blue-400" style={{ width: `${(medium / total) * 100}%` }} title={`${medium} medium`} />}
                    {low > 0 && <div className="bg-gray-300" style={{ width: `${(low / total) * 100}%` }} title={`${low} low/none`} />}
                  </div>
                  <div className="text-xs text-muted-foreground w-12 text-right">{total} tasks</div>
                </div>
              )
            })}
          </div>
          {sortedUsers.filter((u) => u.tasks.length > 0).length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">No tasks assigned this week</div>
          )}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Urgent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400" /> High</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300" /> Low/None</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Clock, AlertCircle, CalendarIcon, ListIcon } from "lucide-react"
import { format, parseISO, isPast, isToday, isTomorrow, startOfWeek, endOfWeek, isWithinInterval } from "date-fns"
import type { CalStick } from "@/types/calstick"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"

// Helper to get priority border color
function getPriorityBorderColor(priority: string | undefined | null): string {
  if (!priority || priority === "none") return "#9ca3af"
  switch (priority) {
    case "urgent": return "#ef4444"
    case "high": return "#f97316"
    case "medium": return "#eab308"
    case "low": return "#3b82f6"
    default: return "#9ca3af"
  }
}

// Helper to get date badge variant
function getDateBadgeVariant(isOverdue: boolean, isDueToday: boolean): "destructive" | "default" | "outline" {
  if (isOverdue) return "destructive"
  if (isDueToday) return "default"
  return "outline"
}

interface AgendaViewProps {
  readonly calsticks: CalStick[]
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onStickClick: (calstick: CalStick) => void
}

type AgendaFilter = "today" | "tomorrow" | "week" | "all"

export function AgendaView({ calsticks, onToggleComplete, onStickClick }: Readonly<AgendaViewProps>) {
  const [filter, setFilter] = useState<AgendaFilter>("today")

  const filterTasks = (tasks: CalStick[]): CalStick[] => {
    const now = new Date()

    switch (filter) {
      case "today":
        return tasks.filter((cs) => cs.calstick_date && isToday(parseISO(cs.calstick_date)))
      case "tomorrow":
        return tasks.filter((cs) => cs.calstick_date && isTomorrow(parseISO(cs.calstick_date)))
      case "week": {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
        return tasks.filter((cs) => {
          if (!cs.calstick_date) return false
          const taskDate = parseISO(cs.calstick_date)
          return isWithinInterval(taskDate, { start: weekStart, end: weekEnd })
        })
      }
      case "all":
      default:
        return tasks
    }
  }

  const filteredTasks = filterTasks(calsticks)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Sort by: completed status, then priority, then date
    if (a.calstick_completed !== b.calstick_completed) {
      return a.calstick_completed ? 1 : -1
    }

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
    const aPriority = priorityOrder[a.calstick_priority as keyof typeof priorityOrder] ?? 4
    const bPriority = priorityOrder[b.calstick_priority as keyof typeof priorityOrder] ?? 4

    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    if (a.calstick_date && b.calstick_date) {
      return parseISO(a.calstick_date).getTime() - parseISO(b.calstick_date).getTime()
    }

    return 0
  })

  const activeTasks = sortedTasks.filter((cs) => !cs.calstick_completed)
  const completedTasks = sortedTasks.filter((cs) => cs.calstick_completed)

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="today" className="text-xs">
            Today
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="text-xs">
            Tomorrow
          </TabsTrigger>
          <TabsTrigger value="week" className="text-xs">
            This Week
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{activeTasks.length}</div>
            <div className="text-xs text-muted-foreground">Active Tasks</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-700">{completedTasks.length}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListIcon className="h-4 w-4" />
            <span>Active ({activeTasks.length})</span>
          </div>
          {activeTasks.map((task) => {
            const isOverdue =
              task.calstick_date && isPast(parseISO(task.calstick_date)) && !isToday(parseISO(task.calstick_date))
            const isDueToday = task.calstick_date && isToday(parseISO(task.calstick_date))

            return (
              <Card
                key={task.id}
                className="cursor-pointer active:scale-[0.98] transition-transform touch-manipulation border-l-4"
                style={{
                  borderLeftColor: getPriorityBorderColor(task.calstick_priority),
                }}
                onClick={() => onStickClick(task)}
              >
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleComplete(task.id, task.calstick_completed)
                      }}
                      className="mt-0.5 touch-manipulation"
                    >
                      <Circle className="h-5 w-5 text-gray-400" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium mb-1 line-clamp-2">{task.stick?.topic || "Untitled"}</h4>
                      {task.content && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.content}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {task.stick?.pad?.name || "No Pad"}
                        </Badge>
                        {task.calstick_date && (
                          <Badge
                            variant={getDateBadgeVariant(!!isOverdue, !!isDueToday)}
                            className="text-xs flex items-center gap-1"
                          >
                            {isOverdue && <AlertCircle className="h-3 w-3" />}
                            {isDueToday && <Clock className="h-3 w-3" />}
                            {!isOverdue && !isDueToday && <CalendarIcon className="h-3 w-3" />}
                            {format(parseISO(task.calstick_date), "MMM d")}
                          </Badge>
                        )}
                        {task.calstick_status && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {task.calstick_status.replace("-", " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Completed ({completedTasks.length})</span>
          </div>
          {completedTasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer active:scale-[0.98] transition-transform touch-manipulation bg-green-50/50"
              onClick={() => onStickClick(task)}
            >
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleComplete(task.id, task.calstick_completed)
                    }}
                    className="mt-0.5 touch-manipulation"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium line-through text-gray-500 mb-1 line-clamp-2">
                      {task.stick?.topic || "Untitled"}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {task.stick?.pad?.name || "No Pad"}
                      </Badge>
                      {task.calstick_date && (
                        <Badge variant="outline" className="text-xs">
                          {format(parseISO(task.calstick_date), "MMM d")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {sortedTasks.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-sm font-medium mb-1">No tasks found</h3>
            <p className="text-xs text-muted-foreground">Try selecting a different time period</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

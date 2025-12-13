"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { Gantt, type Task, ViewMode } from "gantt-task-react"
import "gantt-task-react/dist/index.css"
import { parseISO, addDays, format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  ZoomIn,
  ZoomOut,
  Calendar,
  Route,
  Loader2,
  Accessibility,
  Flag,
  ChevronRight,
  Diamond,
  Table,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { CalStick, Dependency } from "@/types/calstick"

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

function calculateCriticalPath(
  tasks: Task[],
  dependencies: Dependency[],
): {
  criticalTasks: Set<string>
  floatTimes: Map<string, number>
  projectDuration: number
} {
  const criticalTasks = new Set<string>()
  const floatTimes = new Map<string, number>()

  if (tasks.length === 0) {
    return { criticalTasks, floatTimes, projectDuration: 0 }
  }

  // Build adjacency list
  const dependencyMap = new Map<string, string[]>()
  const reverseDependencyMap = new Map<string, string[]>()

  for (const dep of dependencies) {
    if (!dependencyMap.has(dep.depends_on_calstick_id)) {
      dependencyMap.set(dep.depends_on_calstick_id, [])
    }
    dependencyMap.get(dep.depends_on_calstick_id)!.push(dep.calstick_id)

    if (!reverseDependencyMap.has(dep.calstick_id)) {
      reverseDependencyMap.set(dep.calstick_id, [])
    }
    reverseDependencyMap.get(dep.calstick_id)!.push(dep.depends_on_calstick_id)
  }

  // Calculate earliest start times
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const earliestStart = new Map<string, number>()
  const earliestFinish = new Map<string, number>()

  // Topological sort
  const visited = new Set<string>()
  const sorted: string[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const deps = reverseDependencyMap.get(id) || []
    for (const dep of deps) {
      visit(dep)
    }
    sorted.push(id)
  }

  for (const task of tasks) {
    visit(task.id)
  }

  // Forward pass
  for (const id of sorted) {
    const task = taskMap.get(id)
    if (!task) continue

    const deps = reverseDependencyMap.get(id) || []
    let maxPredecessorFinish = task.start.getTime()

    for (const depId of deps) {
      const finish = earliestFinish.get(depId) || 0
      maxPredecessorFinish = Math.max(maxPredecessorFinish, finish)
    }

    earliestStart.set(id, maxPredecessorFinish)
    const duration = task.end.getTime() - task.start.getTime()
    earliestFinish.set(id, maxPredecessorFinish + duration)
  }

  // Find project end time
  let projectEnd = 0

  for (const task of tasks) {
    const finish = earliestFinish.get(task.id) || 0
    if (finish > projectEnd) {
      projectEnd = finish
    }
  }

  // Backward pass to find critical path
  const latestFinish = new Map<string, number>()
  const latestStart = new Map<string, number>()

  for (const id of [...sorted].reverse()) {
    const task = taskMap.get(id)
    if (!task) continue

    const successors = dependencyMap.get(id) || []
    let minSuccessorStart = projectEnd

    for (const succId of successors) {
      const start = latestStart.get(succId) || projectEnd
      minSuccessorStart = Math.min(minSuccessorStart, start)
    }

    if (successors.length === 0) {
      minSuccessorStart = projectEnd
    }

    latestFinish.set(id, minSuccessorStart)
    const duration = task.end.getTime() - task.start.getTime()
    latestStart.set(id, minSuccessorStart - duration)
  }

  // Calculate float and identify critical path
  for (const task of tasks) {
    const es = earliestStart.get(task.id) || 0
    const ls = latestStart.get(task.id) || 0
    const float = (ls - es) / (1000 * 60 * 60 * 24) // Convert to days

    floatTimes.set(task.id, float)

    if (Math.abs(float) < 0.01) {
      // Within 0.01 day tolerance
      criticalTasks.add(task.id)
    }
  }

  const projectDuration = (projectEnd - Math.min(...tasks.map((t) => t.start.getTime()))) / (1000 * 60 * 60 * 24)

  return { criticalTasks, floatTimes, projectDuration }
}

interface StorylinePhase {
  id: string
  name: string
  startDate: Date
  endDate: Date
  tasks: Task[]
  milestones: Task[]
  progress: number
  isCurrent: boolean
}

function generateStoryline(tasks: Task[], dependencies: Dependency[]): StorylinePhase[] {
  if (tasks.length === 0) return []

  // Sort tasks by start date
  const sortedTasks = [...tasks].sort((a, b) => a.start.getTime() - b.start.getTime())

  // Group tasks into phases based on time clusters
  const phases: StorylinePhase[] = []
  let currentPhase: Task[] = []
  let phaseStartDate = sortedTasks[0]?.start || new Date()
  const phaseGapDays = 7 // Consider tasks within 7 days as same phase

  for (const task of sortedTasks) {
    if (currentPhase.length === 0) {
      currentPhase.push(task)
      phaseStartDate = task.start
    } else {
      const lastTask = currentPhase[currentPhase.length - 1]
      const daysDiff = (task.start.getTime() - lastTask.end.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff > phaseGapDays) {
        // Start new phase
        const phaseEndDate = new Date(Math.max(...currentPhase.map((t) => t.end.getTime())))
        const milestones = currentPhase.filter((t) => t.type === "milestone")
        const regularTasks = currentPhase.filter((t) => t.type !== "milestone")
        const progress =
          regularTasks.length > 0
            ? regularTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / regularTasks.length
            : 0

        phases.push({
          id: `phase-${phases.length + 1}`,
          name: `Phase ${phases.length + 1}`,
          startDate: phaseStartDate,
          endDate: phaseEndDate,
          tasks: regularTasks,
          milestones,
          progress,
          isCurrent: new Date() >= phaseStartDate && new Date() <= phaseEndDate,
        })

        currentPhase = [task]
        phaseStartDate = task.start
      } else {
        currentPhase.push(task)
      }
    }
  }

  // Add final phase
  if (currentPhase.length > 0) {
    const phaseEndDate = new Date(Math.max(...currentPhase.map((t) => t.end.getTime())))
    const milestones = currentPhase.filter((t) => t.type === "milestone")
    const regularTasks = currentPhase.filter((t) => t.type !== "milestone")
    const progress =
      regularTasks.length > 0 ? regularTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / regularTasks.length : 0

    phases.push({
      id: `phase-${phases.length + 1}`,
      name: `Phase ${phases.length + 1}`,
      startDate: phaseStartDate,
      endDate: phaseEndDate,
      tasks: regularTasks,
      milestones,
      progress,
      isCurrent: new Date() >= phaseStartDate && new Date() <= phaseEndDate,
    })
  }

  return phases
}

interface GanttChartProps {
  calsticks: CalStick[]
  dependencies?: Dependency[]
  onTaskChange?: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
  onDependencyAdd?: (taskId: string, dependsOnId: string) => Promise<void>
}

export default function GanttChart({ calsticks, dependencies = [], onTaskChange, onDependencyAdd }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showCriticalPath, setShowCriticalPath] = useState(false)
  const [showStoryline, setShowStoryline] = useState(false)
  const [accessibilityMode, setAccessibilityMode] = useState(false)
  const [showTableView, setShowTableView] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { start: Date; end: Date }>>(new Map())
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const VIRTUAL_PAGE_SIZE = 50

  const sortedCalsticks = useMemo(() => {
    return [...calsticks]
      .filter((cs) => cs.calstick_date || cs.calstick_start_date)
      .sort((a, b) => {
        const aDate = a.calstick_start_date || a.calstick_date || ""
        const bDate = b.calstick_start_date || b.calstick_date || ""
        return aDate.localeCompare(bDate)
      })
  }, [calsticks])

  const tasks: Task[] = useMemo(() => {
    return calsticks
      .filter((cs) => cs.calstick_date || cs.calstick_start_date)
      .map((cs) => {
        const startDate = cs.calstick_start_date
          ? parseISO(cs.calstick_start_date)
          : cs.calstick_date
            ? parseISO(cs.calstick_date)
            : new Date()

        const estimatedDays = cs.calstick_estimated_hours ? Math.max(1, Math.ceil(cs.calstick_estimated_hours / 8)) : 1
        const endDate = addDays(startDate, estimatedDays)

        const pending = pendingUpdates.get(cs.id)
        const finalStart = pending?.start || startDate
        const finalEnd = pending?.end || endDate

        const taskDependencies = dependencies
          .filter((d) => d.calstick_id === cs.id)
          .map((d) => d.depends_on_calstick_id)

        return {
          id: cs.id,
          name: truncateText(cs.content, 40),
          start: finalStart,
          end: finalEnd,
          progress: cs.calstick_completed ? 100 : cs.calstick_progress || 0,
          type: "task" as const,
          dependencies: taskDependencies,
          styles: {
            backgroundColor: cs.calstick_completed ? "#22c55e" : "#3b82f6",
            backgroundSelectedColor: cs.calstick_completed ? "#16a34a" : "#2563eb",
            progressColor: cs.calstick_completed ? "#15803d" : "#1d4ed8",
            progressSelectedColor: cs.calstick_completed ? "#166534" : "#1e40af",
          },
        }
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [calsticks, dependencies, pendingUpdates])

  const visibleTasks = useMemo(() => {
    if (tasks.length <= VIRTUAL_PAGE_SIZE) return tasks
    return tasks.slice(visibleRange.start, visibleRange.end)
  }, [tasks, visibleRange])

  const criticalPathData = useMemo(() => {
    if (!showCriticalPath || tasks.length === 0) {
      return { criticalTasks: new Set<string>(), floatTimes: new Map<string, number>(), projectDuration: 0 }
    }
    return calculateCriticalPath(tasks, dependencies)
  }, [tasks, dependencies, showCriticalPath])

  const storyline = useMemo(() => {
    if (!showStoryline || tasks.length === 0) return []
    return generateStoryline(tasks, dependencies)
  }, [tasks, dependencies, showStoryline])

  const styledTasks = useMemo(() => {
    const tasksToStyle = tasks.length > VIRTUAL_PAGE_SIZE ? visibleTasks : tasks

    if (!showCriticalPath) return tasksToStyle

    return tasksToStyle.map((task) => {
      if (criticalPathData.criticalTasks.has(task.id)) {
        return {
          ...task,
          styles: {
            ...task.styles,
            backgroundColor: "#dc2626",
            backgroundSelectedColor: "#b91c1c",
            progressColor: "#991b1b",
            progressSelectedColor: "#7f1d1d",
          },
        }
      }
      return task
    })
  }, [tasks, visibleTasks, criticalPathData, showCriticalPath])

  const handleTaskChange = useCallback(
    async (task: Task) => {
      if (!onTaskChange) return

      // Apply optimistic update immediately
      setPendingUpdates((prev) => {
        const next = new Map(prev)
        next.set(task.id, { start: task.start, end: task.end })
        return next
      })

      // Debounce the actual API call
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(async () => {
        setIsUpdating(true)
        try {
          await onTaskChange(task.id, task.start, task.end)
          // Clear pending update on success
          setPendingUpdates((prev) => {
            const next = new Map(prev)
            next.delete(task.id)
            return next
          })
        } catch (error) {
          console.error("Failed to update task:", error)
          // Revert optimistic update on failure
          setPendingUpdates((prev) => {
            const next = new Map(prev)
            next.delete(task.id)
            return next
          })
        } finally {
          setIsUpdating(false)
        }
      }, 500)
    },
    [onTaskChange],
  )

  const handleScroll = useCallback(() => {
    if (!containerRef.current || tasks.length <= VIRTUAL_PAGE_SIZE) return

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const rowHeight = 50
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 10)
    const endIndex = Math.min(tasks.length, startIndex + VIRTUAL_PAGE_SIZE + 20)

    setVisibleRange({ start: startIndex, end: endIndex })
  }, [tasks.length])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  const getColumnWidth = (mode: ViewMode): number => {
    switch (mode) {
      case ViewMode.Month:
        return 300
      case ViewMode.Week:
        return 250
      default:
        return 60
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No tasks with dates to display in Gantt chart</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="w-full space-y-4" role="region" aria-label="Gantt Chart">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-background border rounded-lg p-3 shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* Table View toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showTableView ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowTableView(!showTableView)}
                  aria-label="Toggle table view"
                >
                  <Table className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Table View</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const modes = [ViewMode.Day, ViewMode.Week, ViewMode.Month]
                    const currentIndex = modes.indexOf(viewMode)
                    if (currentIndex > 0) {
                      setViewMode(modes[currentIndex - 1])
                    }
                  }}
                  disabled={viewMode === ViewMode.Day || showTableView}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const modes = [ViewMode.Day, ViewMode.Week, ViewMode.Month]
                    const currentIndex = modes.indexOf(viewMode)
                    if (currentIndex < modes.length - 1) {
                      setViewMode(modes[currentIndex + 1])
                    }
                  }}
                  disabled={viewMode === ViewMode.Month || showTableView}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>

            {tasks.length > VIRTUAL_PAGE_SIZE && (
              <Badge variant="outline" className="text-xs">
                Showing {visibleRange.end - visibleRange.start} of {tasks.length} tasks
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="critical-path"
                checked={showCriticalPath}
                onCheckedChange={setShowCriticalPath}
                aria-label="Show critical path"
              />
              <Label htmlFor="critical-path" className="flex items-center gap-1 text-sm cursor-pointer">
                <Route className="h-4 w-4" />
                <span className="hidden sm:inline">Critical Path</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="storyline"
                checked={showStoryline}
                onCheckedChange={setShowStoryline}
                aria-label="Show storyline"
              />
              <Label htmlFor="storyline" className="flex items-center gap-1 text-sm cursor-pointer">
                <Flag className="h-4 w-4" />
                <span className="hidden sm:inline">Storyline</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="accessibility-mode"
                checked={accessibilityMode}
                onCheckedChange={setAccessibilityMode}
                aria-label="Accessibility mode"
              />
              <Label htmlFor="accessibility-mode" className="flex items-center gap-1 text-sm cursor-pointer">
                <Accessibility className="h-4 w-4" />
                <span className="hidden sm:inline">A11y</span>
              </Label>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Select view mode">
                <Calendar className="h-4 w-4 mr-2" />
                {viewModeLabels[viewMode]} View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setViewMode(ViewMode.Day)}>Day View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode(ViewMode.Week)}>Week View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode(ViewMode.Month)}>Month View</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Storyline Panel */}
        {showStoryline && storyline.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Project Storyline
                <Badge variant="outline">{storyline.length} phases</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {storyline.map((phase, index) => (
                  <div key={phase.id} className="flex items-center">
                    <Card className={`min-w-[180px] ${phase.isCurrent ? "border-primary ring-2 ring-primary/20" : ""}`}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{phase.name}</span>
                          {phase.isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(phase.startDate, "MMM d")} - {format(phase.endDate, "MMM d")}
                        </div>
                        <Progress value={phase.progress} className="h-1.5" />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{phase.tasks.length} tasks</span>
                          {phase.milestones.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Diamond className="h-3 w-3" />
                              {phase.milestones.length}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    {index < storyline.length - 1 && <ChevronRight className="h-5 w-5 mx-1 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Critical Path Legend */}
        {showCriticalPath && criticalPathData.criticalTasks.size > 0 && (
          <div
            className="flex flex-wrap items-center gap-4 text-sm px-2 bg-muted/50 py-2 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-600" aria-hidden="true" />
              <span>Critical Path ({criticalPathData.criticalTasks.size} tasks)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" aria-hidden="true" />
              <span>Regular Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" aria-hidden="true" />
              <span>Completed</span>
            </div>
            <Badge variant="outline">Project Duration: {Math.ceil(criticalPathData.projectDuration)} days</Badge>
          </div>
        )}

        {/* Gantt Chart Container with Virtual Scrolling */}
        {showTableView ? (
          <div className="w-full overflow-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Task</th>
                  <th className="text-left p-3 font-medium">Assignee</th>
                  <th className="text-left p-3 font-medium">Start Date</th>
                  <th className="text-left p-3 font-medium">End Date</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {sortedCalsticks.map((cs) => {
                  const startDate = cs.calstick_start_date
                    ? parseISO(cs.calstick_start_date)
                    : cs.calstick_date
                      ? parseISO(cs.calstick_date)
                      : null

                  const estimatedDays = cs.calstick_estimated_hours
                    ? Math.max(1, Math.ceil(cs.calstick_estimated_hours / 8))
                    : 1
                  const endDate = startDate ? addDays(startDate, estimatedDays) : null

                  const assigneeInitials =
                    cs.assignee?.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() ||
                    cs.assignee?.email?.[0]?.toUpperCase() ||
                    "?"

                  console.log(
                    "[v0] Timeline table row - Task:",
                    cs.id,
                    "AssigneeId:",
                    cs.calstick_assignee_id,
                    "Assignee:",
                    cs.assignee,
                  )

                  return (
                    <tr key={cs.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">
                        <div className="font-medium">{truncateText(cs.content, 40)}</div>
                        {cs.stick?.topic && <div className="text-xs text-muted-foreground">{cs.stick.topic}</div>}
                      </td>
                      <td className="p-3">
                        {cs.calstick_assignee_id ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              {cs.assignee?.avatar_url && (
                                <img
                                  src={cs.assignee.avatar_url || "/placeholder.svg"}
                                  alt={cs.assignee.full_name || cs.assignee.email || ""}
                                  className="h-full w-full object-cover"
                                />
                              )}
                              <AvatarFallback className="text-xs">
                                {cs.assignee?.full_name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase() ||
                                  cs.assignee?.email?.[0]?.toUpperCase() ||
                                  "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{cs.assignee?.full_name || cs.assignee?.email || "Unknown"}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">{startDate ? format(startDate, "MMM d, yyyy") : "-"}</td>
                      <td className="p-3 text-sm">{endDate ? format(endDate, "MMM d, yyyy") : "-"}</td>
                      <td className="p-3">
                        <Badge variant={cs.calstick_completed ? "default" : "secondary"}>
                          {cs.calstick_completed ? "Complete" : cs.calstick_status || "To Do"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={cs.calstick_completed ? 100 : cs.calstick_progress || 0}
                            className="h-2 w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            {cs.calstick_completed ? 100 : cs.calstick_progress || 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`gantt-wrapper w-full overflow-auto ${accessibilityMode ? "high-contrast" : ""}`}
            style={{ maxHeight: "600px" }}
            role="application"
            aria-label={`Gantt chart with ${tasks.length} tasks`}
          >
            <Gantt
              tasks={styledTasks}
              viewMode={viewMode}
              listCellWidth="155px"
              columnWidth={getColumnWidth(viewMode)}
              onDateChange={onTaskChange ? handleTaskChange : undefined}
            />

            <style jsx global>{`
              .gantt-wrapper {
                background: white;
              }
              .gantt-wrapper * {
                box-sizing: border-box;
              }
              .gantt-wrapper table {
                border-collapse: collapse;
              }
              .gantt-wrapper td,
              .gantt-wrapper th {
                border: 1px solid #e5e7eb;
                padding: 8px;
              }
              .gantt-wrapper svg {
                background: white !important;
              }

              /* High contrast mode for accessibility */
              .gantt-wrapper.high-contrast td,
              .gantt-wrapper.high-contrast th {
                border: 2px solid #000;
              }
              .gantt-wrapper.high-contrast text {
                font-weight: bold;
              }
            `}</style>
          </div>
        )}

        {/* Status Bar */}
        {(isUpdating || pendingUpdates.size > 0) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {pendingUpdates.size > 0
                ? `Saving ${pendingUpdates.size} change${pendingUpdates.size > 1 ? "s" : ""}...`
                : "Updating task..."}
            </span>
          </div>
        )}

        {/* Accessibility Help */}
        {accessibilityMode && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded" role="note">
            <strong>Keyboard Navigation:</strong> Use Tab to move between elements. Arrow keys to navigate within the
            chart. Enter to select a task.
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

const viewModeLabels: Record<ViewMode, string> = {
  [ViewMode.Hour]: "Hour",
  [ViewMode.QuarterDay]: "Quarter Day",
  [ViewMode.HalfDay]: "Half Day",
  [ViewMode.Day]: "Day",
  [ViewMode.Week]: "Week",
  [ViewMode.Month]: "Month",
  [ViewMode.Year]: "Quarter",
}

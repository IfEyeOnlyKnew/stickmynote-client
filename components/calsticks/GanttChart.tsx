"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { Gantt, type Task, ViewMode } from "gantt-task-react"
import "gantt-task-react/dist/index.css"
import { parseISO, addDays, format, differenceInDays, eachDayOfInterval } from "date-fns"
import { useToast } from "@/hooks/use-toast"
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
  Bookmark,
  Users,
  FileDown,
  AlertTriangle,
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

// Helper to get start date from calstick
function getCalstickStartDate(cs: CalStick): Date {
  if (cs.calstick_start_date) return parseISO(cs.calstick_start_date)
  if (cs.calstick_date) return parseISO(cs.calstick_date)
  return new Date()
}

// Helper to get start date or null from calstick
function getCalstickStartDateOrNull(cs: CalStick): Date | null {
  if (cs.calstick_start_date) return parseISO(cs.calstick_start_date)
  if (cs.calstick_date) return parseISO(cs.calstick_date)
  return null
}

// Helper to format pending updates message
function getPendingUpdatesMessage(count: number): string {
  if (count > 0) return `Saving ${count} change${count > 1 ? "s" : ""}...`
  return "Updating task..."
}

// Helper to build dependency adjacency maps
function buildDependencyMaps(dependencies: Dependency[]): {
  dependencyMap: Map<string, string[]>
  reverseDependencyMap: Map<string, string[]>
} {
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

  return { dependencyMap, reverseDependencyMap }
}

// Topological sort helper
function topologicalSort(tasks: Task[], reverseDependencyMap: Map<string, string[]>): string[] {
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

  return sorted
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

  const { dependencyMap, reverseDependencyMap } = buildDependencyMaps(dependencies)
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const earliestStart = new Map<string, number>()
  const earliestFinish = new Map<string, number>()

  const sorted = topologicalSort(tasks, reverseDependencyMap)

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
  const projectEnd = Math.max(...tasks.map((t) => earliestFinish.get(t.id) || 0))

  // Backward pass to find critical path
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

    const duration = task.end.getTime() - task.start.getTime()
    latestStart.set(id, minSuccessorStart - duration)
  }

  // Calculate float and identify critical path
  for (const task of tasks) {
    const es = earliestStart.get(task.id) || 0
    const ls = latestStart.get(task.id) || 0
    const float = (ls - es) / (1000 * 60 * 60 * 24)

    floatTimes.set(task.id, float)

    if (Math.abs(float) < 0.01) {
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

// Helper to create a phase from accumulated tasks
function createPhase(
  phaseTasks: Task[],
  phaseIndex: number,
  startDate: Date
): StorylinePhase {
  const phaseEndDate = new Date(Math.max(...phaseTasks.map((t) => t.end.getTime())))
  const milestones = phaseTasks.filter((t) => t.type === "milestone")
  const regularTasks = phaseTasks.filter((t) => t.type !== "milestone")
  const progress = regularTasks.length > 0
    ? regularTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / regularTasks.length
    : 0
  const now = new Date()

  return {
    id: `phase-${phaseIndex + 1}`,
    name: `Phase ${phaseIndex + 1}`,
    startDate,
    endDate: phaseEndDate,
    tasks: regularTasks,
    milestones,
    progress,
    isCurrent: now >= startDate && now <= phaseEndDate,
  }
}

function generateStoryline(tasks: Task[], dependencies: Dependency[]): StorylinePhase[] {
  if (tasks.length === 0) return []

  const sortedTasks = [...tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
  const phases: StorylinePhase[] = []
  let currentPhase: Task[] = []
  let phaseStartDate = sortedTasks[0]?.start || new Date()
  const phaseGapDays = 7

  for (const task of sortedTasks) {
    if (currentPhase.length === 0) {
      currentPhase.push(task)
      phaseStartDate = task.start
      continue
    }

    const lastTask = currentPhase.at(-1)
    if (!lastTask) continue
    const daysDiff = (task.start.getTime() - lastTask.end.getTime()) / (1000 * 60 * 60 * 24)

    if (daysDiff > phaseGapDays) {
      phases.push(createPhase(currentPhase, phases.length, phaseStartDate))
      currentPhase = [task]
      phaseStartDate = task.start
    } else {
      currentPhase.push(task)
    }
  }

  if (currentPhase.length > 0) {
    phases.push(createPhase(currentPhase, phases.length, phaseStartDate))
  }

  return phases
}

// Resource workload calculation
interface ResourceWorkload {
  userId: string
  userName: string
  workloadByDay: Map<string, number> // date string -> hours
  totalHours: number
  overloadedDays: string[]
}

// Helper to get workload color based on hours
function getWorkloadColor(hours: number): string {
  if (hours > 8) return "bg-red-500"
  if (hours > 6) return "bg-orange-400"
  if (hours > 4) return "bg-yellow-400"
  return "bg-green-400"
}

// Helper to get assignee display name
function getAssigneeDisplayName(cs: CalStick): string {
  return cs.assignee?.full_name || cs.assignee?.username || cs.assignee?.email || "Unknown"
}

// Helper to get or create workload entry
function getOrCreateWorkload(
  workloadMap: Map<string, ResourceWorkload>,
  assigneeId: string,
  displayName: string
): ResourceWorkload {
  if (!workloadMap.has(assigneeId)) {
    workloadMap.set(assigneeId, {
      userId: assigneeId,
      userName: displayName,
      workloadByDay: new Map(),
      totalHours: 0,
      overloadedDays: [],
    })
  }
  return workloadMap.get(assigneeId)!
}

// Helper to add workload hours for a date range
function addWorkloadHours(
  workload: ResourceWorkload,
  startDate: Date,
  endDate: Date,
  hoursPerDay: number
): void {
  try {
    const daysInRange = eachDayOfInterval({ start: startDate, end: endDate })
    for (const day of daysInRange) {
      const dateKey = format(day, "yyyy-MM-dd")
      const currentHours = workload.workloadByDay.get(dateKey) || 0
      workload.workloadByDay.set(dateKey, currentHours + hoursPerDay)
      workload.totalHours += hoursPerDay
    }
  } catch {
    // Invalid date range, skip
  }
}

// Helper to find overloaded days in workloads
function findOverloadedDays(workloadMap: Map<string, ResourceWorkload>): void {
  for (const workload of workloadMap.values()) {
    for (const [date, hours] of workload.workloadByDay) {
      if (hours > 8) {
        workload.overloadedDays.push(date)
      }
    }
  }
}

function calculateResourceWorkload(calsticks: CalStick[]): ResourceWorkload[] {
  const workloadMap = new Map<string, ResourceWorkload>()

  for (const cs of calsticks) {
    if (!cs.calstick_assignee_id || cs.calstick_completed) continue

    const startDate = getCalstickStartDateOrNull(cs)
    if (!startDate) continue

    const estimatedHours = cs.calstick_estimated_hours || 8
    const days = Math.max(1, Math.ceil(estimatedHours / 8))
    const hoursPerDay = estimatedHours / days
    const endDate = addDays(startDate, days - 1)

    const workload = getOrCreateWorkload(workloadMap, cs.calstick_assignee_id, getAssigneeDisplayName(cs))
    addWorkloadHours(workload, startDate, endDate, hoursPerDay)
  }

  findOverloadedDays(workloadMap)

  return Array.from(workloadMap.values()).sort((a, b) => b.totalHours - a.totalHours)
}

// Baseline variance calculation
interface BaselineVariance {
  taskId: string
  taskName: string
  plannedStart: Date
  plannedEnd: Date
  actualStart: Date
  actualEnd: Date
  startVarianceDays: number
  endVarianceDays: number
  isDelayed: boolean
  isAhead: boolean
}

function calculateBaselineVariance(calsticks: CalStick[]): BaselineVariance[] {
  const variances: BaselineVariance[] = []

  for (const cs of calsticks) {
    if (!cs.baseline_start_date || !cs.baseline_end_date) continue

    const plannedStart = parseISO(cs.baseline_start_date)
    const plannedEnd = parseISO(cs.baseline_end_date)
    const actualStart = getCalstickStartDateOrNull(cs)

    if (!actualStart) continue

    const estimatedDays = cs.calstick_estimated_hours ? Math.max(1, Math.ceil(cs.calstick_estimated_hours / 8)) : 1
    const actualEnd = addDays(actualStart, estimatedDays)

    const startVariance = differenceInDays(actualStart, plannedStart)
    const endVariance = differenceInDays(actualEnd, plannedEnd)

    variances.push({
      taskId: cs.id,
      taskName: cs.content,
      plannedStart,
      plannedEnd,
      actualStart,
      actualEnd,
      startVarianceDays: startVariance,
      endVarianceDays: endVariance,
      isDelayed: endVariance > 0,
      isAhead: endVariance < 0,
    })
  }

  return variances
}

interface GanttChartProps {
  readonly calsticks: CalStick[]
  readonly dependencies?: Dependency[]
  readonly onTaskChange?: (taskId: string, startDate: Date, endDate: Date) => Promise<void>
  readonly onDependencyAdd?: (taskId: string, dependsOnId: string) => Promise<void>
  readonly onRefresh?: () => void
}

export default function GanttChart({ calsticks, dependencies = [], onTaskChange, onDependencyAdd: _onDependencyAdd, onRefresh }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showCriticalPath, setShowCriticalPath] = useState(false)
  const [showStoryline, setShowStoryline] = useState(false)
  const [accessibilityMode, setAccessibilityMode] = useState(false)
  const [showTableView, setShowTableView] = useState(false)
  const [showBaseline, setShowBaseline] = useState(false)
  const [showResourceView, setShowResourceView] = useState(false)
  const [settingBaseline, setSettingBaseline] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { start: Date; end: Date }>>(new Map())
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

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
        const startDate = getCalstickStartDate(cs)

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

  const baselineVariances = useMemo(() => {
    if (!showBaseline) return []
    return calculateBaselineVariance(calsticks)
  }, [calsticks, showBaseline])

  const resourceWorkloads = useMemo(() => {
    if (!showResourceView) return []
    return calculateResourceWorkload(calsticks)
  }, [calsticks, showResourceView])

  const hasBaseline = useMemo(() => {
    return calsticks.some(cs => cs.baseline_set_at)
  }, [calsticks])

  const handleSetBaseline = async () => {
    try {
      setSettingBaseline(true)
      const response = await fetch("/api/calsticks/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setAll: true }),
      })

      if (!response.ok) {
        throw new Error("Failed to set baseline")
      }

      const data = await response.json()
      toast({
        title: "Baseline Set",
        description: data.message,
      })
      onRefresh?.()
    } catch {
      toast({
        title: "Error",
        description: "Failed to set baseline",
        variant: "destructive",
      })
    } finally {
      setSettingBaseline(false)
    }
  }

  const handleClearBaseline = async () => {
    try {
      setSettingBaseline(true)
      const response = await fetch("/api/calsticks/baseline", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      })

      if (!response.ok) {
        throw new Error("Failed to clear baseline")
      }

      toast({
        title: "Baseline Cleared",
        description: "All baselines have been removed",
      })
      setShowBaseline(false)
      onRefresh?.()
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear baseline",
        variant: "destructive",
      })
    } finally {
      setSettingBaseline(false)
    }
  }

  const handleExportPDF = async () => {
    try {
      // Dynamic imports with error handling for missing packages
      let html2canvas: any
      let jsPDF: any

      try {
        const html2canvasModule = await import("html2canvas" as any)
        html2canvas = html2canvasModule.default
      } catch {
        toast({
          title: "Package Missing",
          description: "Install html2canvas: pnpm add html2canvas",
          variant: "destructive",
        })
        return
      }

      try {
        const jspdfModule = await import("jspdf" as any)
        jsPDF = jspdfModule.jsPDF
      } catch {
        toast({
          title: "Package Missing",
          description: "Install jspdf: pnpm add jspdf",
          variant: "destructive",
        })
        return
      }

      const element = containerRef.current
      if (!element) {
        toast({
          title: "Error",
          description: "Could not find chart to export",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Exporting...",
        description: "Generating PDF, please wait",
      })

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      })

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height)
      pdf.save(`gantt-chart-${format(new Date(), "yyyy-MM-dd")}.pdf`)

      toast({
        title: "Export Complete",
        description: "Gantt chart has been exported to PDF",
      })
    } catch (error) {
      console.error("PDF export error:", error)
      toast({
        title: "Export Failed",
        description: "Could not export PDF. Check console for details.",
        variant: "destructive",
      })
    }
  }

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
      <section className="w-full space-y-4" aria-label="Gantt Chart">
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

            {/* Baseline buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetBaseline}
                  disabled={settingBaseline}
                  aria-label="Set baseline"
                >
                  {settingBaseline ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Set Baseline (snapshot current dates)</TooltipContent>
            </Tooltip>

            {/* PDF Export */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  aria-label="Export to PDF"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export to PDF</TooltipContent>
            </Tooltip>
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
                id="baseline"
                checked={showBaseline}
                onCheckedChange={setShowBaseline}
                disabled={!hasBaseline}
                aria-label="Show baseline comparison"
              />
              <Label htmlFor="baseline" className="flex items-center gap-1 text-sm cursor-pointer">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">Baseline</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="resource-view"
                checked={showResourceView}
                onCheckedChange={setShowResourceView}
                aria-label="Show resource workload"
              />
              <Label htmlFor="resource-view" className="flex items-center gap-1 text-sm cursor-pointer">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Resources</span>
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

        {/* Baseline Variance Panel */}
        {showBaseline && baselineVariances.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Baseline Comparison
                  <Badge variant="outline">{baselineVariances.length} tasks</Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearBaseline}
                  disabled={settingBaseline}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Clear Baseline
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {baselineVariances.filter(v => v.isDelayed || v.isAhead).slice(0, 10).map((variance) => (
                  <div
                    key={variance.taskId}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      variance.isDelayed ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"
                    }`}
                  >
                    <span className="truncate max-w-[200px]">{truncateText(variance.taskName, 30)}</span>
                    <div className="flex items-center gap-2">
                      {variance.isDelayed && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          +{variance.endVarianceDays}d late
                        </Badge>
                      )}
                      {variance.isAhead && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          {variance.endVarianceDays}d ahead
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {baselineVariances.some(v => !v.isDelayed && !v.isAhead) && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    {baselineVariances.filter(v => !v.isDelayed && !v.isAhead).length} tasks on schedule
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resource Workload Panel */}
        {showResourceView && resourceWorkloads.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Resource Workload
                <Badge variant="outline">{resourceWorkloads.length} resources</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-3">
                {resourceWorkloads.map((workload) => {
                  const hasOverload = workload.overloadedDays.length > 0
                  return (
                    <div key={workload.userId} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {workload.userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{workload.userName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {Math.round(workload.totalHours)}h total
                          </span>
                          {hasOverload && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {workload.overloadedDays.length} overloaded days
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from(workload.workloadByDay.entries()).slice(0, 14).map(([date, hours]) => (
                          <Tooltip key={date}>
                            <TooltipTrigger asChild>
                              <div
                                className={`h-4 w-4 rounded-sm ${getWorkloadColor(hours)}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {format(parseISO(date), "MMM d")}: {Math.round(hours)}h
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-green-400" /> &lt;4h
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-yellow-400" /> 4-6h
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-orange-400" /> 6-8h
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-red-500" /> &gt;8h (overload)
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Critical Path Legend */}
        {showCriticalPath && criticalPathData.criticalTasks.size > 0 && (
          <output
            className="flex flex-wrap items-center gap-4 text-sm px-2 bg-muted/50 py-2 rounded-lg"
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
          </output>
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
                  const startDate = getCalstickStartDateOrNull(cs)

                  const estimatedDays = cs.calstick_estimated_hours
                    ? Math.max(1, Math.ceil(cs.calstick_estimated_hours / 8))
                    : 1
                  const endDate = startDate ? addDays(startDate, estimatedDays) : null

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
                                // eslint-disable-next-line @next/next/no-img-element
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

            <style dangerouslySetInnerHTML={{ __html: `
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
            ` }} />
          </div>
        )}

        {/* Status Bar */}
        {(isUpdating || pendingUpdates.size > 0) && (
          <output className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{getPendingUpdatesMessage(pendingUpdates.size)}</span>
          </output>
        )}

        {/* Accessibility Help */}
        {accessibilityMode && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded" role="note">
            <strong>Keyboard Navigation:</strong> Use Tab to move between elements. Arrow keys to navigate within the
            chart. Enter to select a task.
          </div>
        )}
      </section>
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

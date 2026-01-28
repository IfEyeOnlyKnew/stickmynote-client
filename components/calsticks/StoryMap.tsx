"use client"

import { useMemo, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Target,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalStick } from "@/types/calstick"
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, isWithinInterval } from "date-fns"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// Story Map structure types
interface Epic {
  id: string
  name: string
  color: string
  order: number
}

interface UserActivity {
  id: string
  name: string
  epicId: string
  order: number
}

interface Release {
  id: string
  name: string
  startDate: Date
  endDate: Date
  order: number
}

interface StoryMapProps {
  readonly calsticks: CalStick[]
  readonly onTaskClick?: (task: CalStick) => void
  readonly onTaskMove?: (taskId: string, newEpicId: string, newReleaseId: string) => Promise<void>
  readonly onEpicCreate?: (name: string) => Promise<void>
  readonly onReleaseCreate?: (name: string, startDate: Date, endDate: Date) => Promise<void>
}

// Generate releases based on date ranges
function generateReleases(calsticks: CalStick[]): Release[] {
  const tasksWithDates = calsticks.filter((cs) => cs.calstick_start_date || cs.calstick_date)

  if (tasksWithDates.length === 0) {
    // Generate 4 default weekly releases
    const releases: Release[] = []
    const today = new Date()
    for (let i = 0; i < 4; i++) {
      const start = startOfWeek(addWeeks(today, i))
      const end = endOfWeek(addWeeks(today, i))
      releases.push({
        id: `release-${i + 1}`,
        name: `Sprint ${i + 1}`,
        startDate: start,
        endDate: end,
        order: i,
      })
    }
    return releases
  }

  // Find date range and create weekly releases
  const dates = tasksWithDates.map((cs) =>
    parseISO(cs.calstick_start_date || cs.calstick_date || new Date().toISOString()),
  )
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

  const releases: Release[] = []
  let currentWeekStart = startOfWeek(minDate)
  let releaseNum = 1

  while (currentWeekStart <= maxDate) {
    releases.push({
      id: `release-${releaseNum}`,
      name: `Sprint ${releaseNum}`,
      startDate: currentWeekStart,
      endDate: endOfWeek(currentWeekStart),
      order: releaseNum - 1,
    })
    currentWeekStart = addWeeks(currentWeekStart, 1)
    releaseNum++
  }

  return releases
}

// Generate epics from task labels or create default ones
function generateEpics(calsticks: CalStick[]): Epic[] {
  const epicColors = [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#f97316", // orange
    "#22c55e", // green
    "#06b6d4", // cyan
  ]

  // Group by labels or priority
  const epicMap = new Map<string, Epic>()

  calsticks.forEach((cs) => {
    const epicName = cs.calstick_labels?.[0] || cs.calstick_priority || "Backlog"
    if (!epicMap.has(epicName)) {
      epicMap.set(epicName, {
        id: `epic-${epicName.toLowerCase().replaceAll(/\s+/g, "-")}`,
        name: epicName,
        color: epicColors[epicMap.size % epicColors.length],
        order: epicMap.size,
      })
    }
  })

  // Ensure at least one epic exists
  if (epicMap.size === 0) {
    epicMap.set("Backlog", {
      id: "epic-backlog",
      name: "Backlog",
      color: epicColors[0],
      order: 0,
    })
  }

  return Array.from(epicMap.values()).sort((a, b) => a.order - b.order)
}

// Sortable task card props
interface SortableTaskCardProps {
  readonly task: CalStick
  readonly onClick?: (task: CalStick) => void
}

function SortableTaskCard({ task, onClick }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getStatusIcon = () => {
    if (task.calstick_completed) return <CheckCircle2 className="h-3 w-3 text-green-500" />
    if (task.calstick_status === "in_progress") return <Clock className="h-3 w-3 text-blue-500" />
    if (task.calstick_priority === "high") return <AlertCircle className="h-3 w-3 text-red-500" />
    return <Circle className="h-3 w-3 text-muted-foreground" />
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-card border rounded-lg p-2 shadow-sm hover:shadow-md transition-all cursor-pointer text-left w-full",
        isDragging && "ring-2 ring-primary",
        task.calstick_completed && "opacity-60",
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start gap-2">
        <span {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            {getStatusIcon()}
            <span className="text-xs font-medium truncate">{(task.content || task.stick?.topic || "Untitled").slice(0, 50)}</span>
          </div>
          {task.calstick_estimated_hours && (
            <Badge variant="outline" className="text-[10px] h-4">
              {task.calstick_estimated_hours}h
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

// Epic row props
interface EpicRowProps {
  readonly epic: Epic
  readonly releases: Release[]
  readonly tasks: CalStick[]
  readonly isExpanded: boolean
  readonly onToggle: () => void
  readonly onTaskClick?: (task: CalStick) => void
}

// Epic row component
function EpicRow({ epic, releases, tasks, isExpanded, onToggle, onTaskClick }: EpicRowProps) {
  // Group tasks by release
  const tasksByRelease = useMemo(() => {
    const grouped = new Map<string, CalStick[]>()
    releases.forEach((release) => grouped.set(release.id, []))

    tasks.forEach((task) => {
      const taskDate = task.calstick_start_date || task.calstick_date
      if (!taskDate) {
        // Put in first release if no date
        const firstRelease = releases[0]
        if (firstRelease) {
          grouped.get(firstRelease.id)?.push(task)
        }
        return
      }

      const date = parseISO(taskDate)
      const matchingRelease = releases.find((r) => isWithinInterval(date, { start: r.startDate, end: r.endDate }))

      if (matchingRelease) {
        grouped.get(matchingRelease.id)?.push(task)
      } else {
        // Put in last release if date is beyond
        const lastRelease = releases.at(-1)
        if (lastRelease) {
          grouped.get(lastRelease.id)?.push(task)
        }
      }
    })

    return grouped
  }, [tasks, releases])

  const completedCount = tasks.filter((t) => t.calstick_completed).length
  const totalCount = tasks.length

  return (
    <div className="border-b last:border-b-0">
      {/* Epic Header */}
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors w-full text-left"
        onClick={onToggle}
        style={{ borderLeft: `4px solid ${epic.color}` }}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Layers className="h-4 w-4" style={{ color: epic.color }} />
        <span className="font-medium text-sm flex-1">{epic.name}</span>
        <Badge variant="outline" className="text-xs">
          {completedCount}/{totalCount}
        </Badge>
      </button>

      {/* Task Grid */}
      {isExpanded && (
        <div className="flex">
          {releases.map((release) => {
            const releaseTasks = tasksByRelease.get(release.id) || []
            return (
              <div
                key={release.id}
                className="flex-1 min-w-[200px] border-r last:border-r-0 p-2 min-h-[100px] bg-background"
              >
                <SortableContext items={releaseTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {releaseTasks.map((task) => (
                      <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} />
                    ))}
                    {releaseTasks.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                        No tasks
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function StoryMap({ calsticks, onTaskClick, onTaskMove, onEpicCreate, onReleaseCreate }: StoryMapProps) {
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())
  const [activeTask, setActiveTask] = useState<CalStick | null>(null)
  const [newEpicName, setNewEpicName] = useState("")
  const [showNewEpicInput, setShowNewEpicInput] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const releases = useMemo(() => generateReleases(calsticks), [calsticks])
  const epics = useMemo(() => generateEpics(calsticks), [calsticks])

  // Group tasks by epic
  const tasksByEpic = useMemo(() => {
    const grouped = new Map<string, CalStick[]>()
    epics.forEach((epic) => grouped.set(epic.id, []))

    calsticks.forEach((task) => {
      const epicName = task.calstick_labels?.[0] || task.calstick_priority || "Backlog"
      const epic = epics.find((e) => e.name === epicName)
      if (epic) {
        grouped.get(epic.id)?.push(task)
      } else {
        // Default to first epic
        const firstEpic = epics[0]
        if (firstEpic) {
          grouped.get(firstEpic.id)?.push(task)
        }
      }
    })

    return grouped
  }, [calsticks, epics])

  // Expand all epics by default
  useMemo(() => {
    if (expandedEpics.size === 0 && epics.length > 0) {
      setExpandedEpics(new Set(epics.map((e) => e.id)))
    }
  }, [epics, expandedEpics.size])

  const toggleEpic = useCallback((epicId: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(epicId)) {
        next.delete(epicId)
      } else {
        next.add(epicId)
      }
      return next
    })
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = calsticks.find((t) => t.id === event.active.id)
      if (task) {
        setActiveTask(task)
      }
    },
    [calsticks],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null)

      if (!event.over || !onTaskMove) return

      // Parse the drop target to determine new epic and release
      // This is a simplified implementation - taskId is event.active.id
    },
    [onTaskMove],
  )

  const handleCreateEpic = useCallback(async () => {
    if (!newEpicName.trim() || !onEpicCreate) return
    await onEpicCreate(newEpicName.trim())
    setNewEpicName("")
    setShowNewEpicInput(false)
  }, [newEpicName, onEpicCreate])

  // Calculate totals
  const totalTasks = calsticks.length
  const completedTasks = calsticks.filter((t) => t.calstick_completed).length
  const totalEstimatedHours = calsticks.reduce((sum, t) => sum + (t.calstick_estimated_hours || 0), 0)

  if (calsticks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No tasks to display</h3>
          <p className="text-muted-foreground text-sm">Create some tasks to see them organized in the Story Map</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {/* Header Stats */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                <Target className="h-3 w-3" />
                {totalTasks} tasks
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {completedTasks} completed
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {totalEstimatedHours}h estimated
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {showNewEpicInput ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newEpicName}
                    onChange={(e) => setNewEpicName(e.target.value)}
                    placeholder="Epic name..."
                    className="h-8 w-40"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateEpic()}
                  />
                  <Button size="sm" variant="outline" onClick={handleCreateEpic}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewEpicInput(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowNewEpicInput(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Epic
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setExpandedEpics(new Set(epics.map((e) => e.id)))}>
                    Expand All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setExpandedEpics(new Set())}>Collapse All</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Story Map Grid */}
          <Card className="overflow-hidden">
            {/* Release Headers */}
            <div className="flex border-b bg-muted/30">
              <div className="w-[200px] min-w-[200px] px-3 py-2 border-r font-medium text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Epics / Sprints
              </div>
              {releases.map((release) => (
                <div key={release.id} className="flex-1 min-w-[200px] px-3 py-2 border-r last:border-r-0 text-center">
                  <div className="font-medium text-sm">{release.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(release.startDate, "MMM d")} - {format(release.endDate, "MMM d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Epic Rows */}
            <div>
              {epics.map((epic) => (
                <EpicRow
                  key={epic.id}
                  epic={epic}
                  releases={releases}
                  tasks={tasksByEpic.get(epic.id) || []}
                  isExpanded={expandedEpics.has(epic.id)}
                  onToggle={() => toggleEpic(epic.id)}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-2">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-500" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span>High Priority</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-muted-foreground" />
              <span>To Do</span>
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && (
            <div className="bg-card border rounded-lg p-2 shadow-lg">
              <span className="text-xs font-medium">{(activeTask.content || activeTask.stick?.topic || "Untitled").slice(0, 50)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  )
}

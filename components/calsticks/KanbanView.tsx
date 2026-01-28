"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  AlertCircle,
  GripVertical,
  Archive,
  Settings2,
  Filter,
  Users,
  Tag,
  Folder,
  X,
} from "lucide-react"
import { format, parseISO, isPast, isToday, differenceInDays } from "date-fns"
import type { CalStick } from "@/types/calstick"
import { ArchivedTasksDialog } from "./ArchivedTasksDialog"
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"

// WIP Limits configuration per column
export interface WipLimits {
  todo: number | null
  "in-progress": number | null
  "in-review": number | null
  done: number | null
  blocked: number | null
}

// Swimlane grouping options
export type SwimlaneGroupBy = "none" | "assignee" | "priority" | "project"

// Quick filter options
export interface QuickFilters {
  priority: string | null
  assignee: string | null
  label: string | null
  overdue: boolean
}

interface KanbanViewProps {
  readonly calsticks: CalStick[]
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onUpdateStatus: (id: string, status: string) => void
  readonly onStickClick: (calstick: CalStick) => void
  readonly autoArchiveDays?: number
  readonly wipLimits?: WipLimits
  readonly onWipLimitsChange?: (limits: WipLimits) => void
  readonly swimlaneGroupBy?: SwimlaneGroupBy
  readonly onSwimlaneGroupByChange?: (groupBy: SwimlaneGroupBy) => void
}

const DEFAULT_WIP_LIMITS: WipLimits = {
  todo: null,
  "in-progress": 5,
  "in-review": 3,
  done: null,
  blocked: null,
}

// Calculate card aging - how long a task has been in its current status
function getCardAging(task: CalStick): { days: number; level: "fresh" | "aging" | "stale" | "critical" } {
  // Use updated_at as proxy for when status last changed, or created_at
  const lastUpdate = task.updated_at || task.created_at
  if (!lastUpdate) return { days: 0, level: "fresh" }

  const days = differenceInDays(new Date(), parseISO(lastUpdate))

  // Aging levels based on days in column
  if (days <= 2) return { days, level: "fresh" }
  if (days <= 5) return { days, level: "aging" }
  if (days <= 10) return { days, level: "stale" }
  return { days, level: "critical" }
}

// Card aging indicator colors
const agingColors = {
  fresh: "",
  aging: "border-l-yellow-400",
  stale: "border-l-orange-500",
  critical: "border-l-red-600",
}

const agingBgColors = {
  fresh: "",
  aging: "bg-yellow-50/50",
  stale: "bg-orange-50/50",
  critical: "bg-red-50/50",
}

// Helper to get badge variant based on due date status
function getDueDateBadgeVariant(isOverdue: boolean, isDueToday: boolean): "destructive" | "default" | "outline" {
  if (isOverdue) return "destructive"
  if (isDueToday) return "default"
  return "outline"
}

// Helper to get badge variant based on WIP limit status
function getWipLimitBadgeVariant(isOverLimit: boolean, isAtLimit: boolean): "destructive" | "default" | "secondary" {
  if (isOverLimit) return "destructive"
  if (isAtLimit) return "default"
  return "secondary"
}

// Helper to check if task is overdue
function isTaskOverdue(task: CalStick): boolean {
  return Boolean(
    task.calstick_date &&
    isPast(parseISO(task.calstick_date)) &&
    !task.calstick_completed &&
    !isToday(parseISO(task.calstick_date))
  )
}

// Helper to check if task is due today
function isTaskDueToday(task: CalStick): boolean {
  return Boolean(task.calstick_date && isToday(parseISO(task.calstick_date)) && !task.calstick_completed)
}

function SortableTaskCard({
  task,
  onToggleComplete,
  onStickClick,
  autoArchiveDays,
  showAging = true,
}: {
  readonly task: CalStick
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onStickClick: (task: CalStick) => void
  readonly autoArchiveDays?: number
  readonly showAging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
  }

  const isOverdue = isTaskOverdue(task)
  const isDueToday = isTaskDueToday(task)
  const creatorName = task.user?.username || task.user?.full_name || task.user?.email || "Unknown"
  const assigneeName = task.assignee?.username || task.assignee?.full_name || null

  const daysUntilArchive =
    task.calstick_completed && task.calstick_completed_at && autoArchiveDays
      ? autoArchiveDays - differenceInDays(new Date(), parseISO(task.calstick_completed_at))
      : null

  // Card aging calculation (only for non-completed tasks)
  const aging = !task.calstick_completed && showAging ? getCardAging(task) : null

  const priorityColors = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
    none: "bg-gray-400",
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-3 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] border-l-4",
        aging ? agingColors[aging.level] : "",
        aging ? agingBgColors[aging.level] : ""
      )}
      onClick={() => onStickClick(task)}
    >
      <CardHeader className="pb-3 pt-3 px-4">
        <div className="flex items-start gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-0.5 touch-none">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete(task.id, task.calstick_completed)
            }}
            className="mt-0.5"
          >
            {task.calstick_completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {task.calstick_priority && task.calstick_priority !== "none" && (
                <div
                  className={`w-2 h-2 rounded-full ${priorityColors[task.calstick_priority as keyof typeof priorityColors]}`}
                  title={task.calstick_priority}
                />
              )}
              <h4 className={`text-sm font-medium ${task.calstick_completed ? "line-through text-gray-500" : ""}`}>
                {task.content || task.stick?.topic || "Untitled"}
              </h4>
            </div>
            {task.stick?.topic && task.content && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Topic: {task.stick.topic}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {task.stick?.pad?.name}
          </Badge>
          {task.calstick_date && (
            <Badge
              variant={getDueDateBadgeVariant(isOverdue, isDueToday)}
              className="text-xs flex items-center gap-1"
            >
              {isOverdue && <AlertCircle className="h-3 w-3" />}
              {isDueToday && <Clock className="h-3 w-3" />}
              {!isOverdue && !isDueToday && <Clock className="h-3 w-3" />}
              {format(parseISO(task.calstick_date), "MMM d")}
            </Badge>
          )}
          {task.calstick_labels && task.calstick_labels.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {task.calstick_labels[0]}
            </Badge>
          )}
          {/* Card aging indicator */}
          {aging && aging.level !== "fresh" && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs flex items-center gap-1",
                aging.level === "aging" && "text-yellow-600 border-yellow-300",
                aging.level === "stale" && "text-orange-600 border-orange-300",
                aging.level === "critical" && "text-red-600 border-red-300"
              )}
              title={`This card has been in this column for ${aging.days} days`}
            >
              <Clock className="h-3 w-3" />
              {aging.days}d
            </Badge>
          )}
          {daysUntilArchive !== null && daysUntilArchive > 0 && daysUntilArchive <= 7 && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-600 border-amber-300">
              <Archive className="h-3 w-3" />
              {daysUntilArchive}d
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <User className="h-3 w-3" />
            {assigneeName || creatorName}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function KanbanColumn({
  column,
  onToggleComplete,
  onStickClick,
  autoArchiveDays,
  wipLimit,
  showAging,
}: {
  readonly column: { id: string; title: string; tasks: CalStick[]; color: string }
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onStickClick: (task: CalStick) => void
  readonly autoArchiveDays?: number
  readonly wipLimit?: number | null
  readonly showAging?: boolean
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  })

  const taskCount = column.tasks.length
  const isOverWipLimit = wipLimit !== null && wipLimit !== undefined && taskCount > wipLimit
  const isAtWipLimit = wipLimit !== null && wipLimit !== undefined && taskCount === wipLimit

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg p-4 min-h-[500px] transition-colors",
        column.color,
        isOverWipLimit && "ring-2 ring-red-400 bg-red-50"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">{column.title}</h3>
        <div className="flex items-center gap-1">
          <Badge
            variant={getWipLimitBadgeVariant(isOverWipLimit, isAtWipLimit)}
            className={cn(
              "text-xs",
              isOverWipLimit && "animate-pulse"
            )}
          >
            {taskCount}
            {wipLimit !== null && wipLimit !== undefined && (
              <span className="text-muted-foreground">/{wipLimit}</span>
            )}
          </Badge>
          {isOverWipLimit && (
            <span title="WIP limit exceeded!">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </span>
          )}
        </div>
      </div>
      {isOverWipLimit && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
          WIP limit exceeded! Consider completing or moving tasks.
        </div>
      )}
      <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-0 min-h-[400px]">
          {column.tasks.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
              Drop tasks here
            </div>
          ) : (
            column.tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onStickClick={onStickClick}
                autoArchiveDays={autoArchiveDays}
                showAging={showAging}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function KanbanView({
  calsticks,
  onToggleComplete,
  onUpdateStatus,
  onStickClick,
  autoArchiveDays = 14,
  wipLimits: externalWipLimits,
  onWipLimitsChange,
  swimlaneGroupBy: externalSwimlaneGroupBy,
  onSwimlaneGroupByChange,
}: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Local state for WIP limits (with external override support)
  const [localWipLimits, setLocalWipLimits] = useState<WipLimits>(DEFAULT_WIP_LIMITS)
  const wipLimits = externalWipLimits || localWipLimits

  // Local state for swimlane grouping
  const [localSwimlaneGroupBy, setLocalSwimlaneGroupBy] = useState<SwimlaneGroupBy>("none")
  const swimlaneGroupBy = externalSwimlaneGroupBy || localSwimlaneGroupBy

  // Quick filters state
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({
    priority: null,
    assignee: null,
    label: null,
    overdue: false,
  })

  // Show aging indicators
  const [showAging, setShowAging] = useState(true)

  // WIP settings popover
  const [showWipSettings, setShowWipSettings] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
  )

  const filterAutoHiddenTasks = (tasks: CalStick[]) => {
    if (autoArchiveDays === 0) return tasks // 0 means show all

    return tasks.filter((task) => {
      if (!task.calstick_completed || !task.calstick_completed_at) return true
      if (task.is_archived) return false
      const daysSinceCompleted = differenceInDays(new Date(), parseISO(task.calstick_completed_at))
      return daysSinceCompleted < autoArchiveDays
    })
  }

  // Apply quick filters
  const applyQuickFilters = (tasks: CalStick[]) => {
    return tasks.filter((task) => {
      // Priority filter
      if (quickFilters.priority && task.calstick_priority !== quickFilters.priority) {
        return false
      }
      // Assignee filter
      if (quickFilters.assignee) {
        const assigneeId = task.calstick_assignee_id || task.assignee?.id
        if (assigneeId !== quickFilters.assignee) {
          return false
        }
      }
      // Label filter
      if (quickFilters.label) {
        if (!task.calstick_labels?.includes(quickFilters.label)) {
          return false
        }
      }
      // Overdue filter
      if (quickFilters.overdue) {
        if (!task.calstick_date || task.calstick_completed) return false
        const dueDate = parseISO(task.calstick_date)
        if (!isPast(dueDate) || isToday(dueDate)) return false
      }
      return true
    })
  }

  // Get unique values for filter dropdowns
  const uniquePriorities = useMemo(() => {
    const priorities = new Set<string>()
    calsticks.forEach((cs) => {
      if (cs.calstick_priority && cs.calstick_priority !== "none") {
        priorities.add(cs.calstick_priority)
      }
    })
    return Array.from(priorities)
  }, [calsticks])

  const uniqueAssignees = useMemo(() => {
    const assignees = new Map<string, { id: string; name: string }>()
    calsticks.forEach((cs) => {
      const assignee = cs.assignee
      if (assignee) {
        assignees.set(assignee.id, {
          id: assignee.id,
          name: assignee.username || assignee.full_name || assignee.email || "Unknown",
        })
      }
    })
    return Array.from(assignees.values())
  }, [calsticks])

  const uniqueLabels = useMemo(() => {
    const labels = new Set<string>()
    calsticks.forEach((cs) => {
      if (cs.calstick_labels) {
        cs.calstick_labels.forEach((label) => labels.add(label))
      }
    })
    return Array.from(labels)
  }, [calsticks])

  const hasActiveFilters = quickFilters.priority || quickFilters.assignee || quickFilters.label || quickFilters.overdue

  const clearAllFilters = () => {
    setQuickFilters({
      priority: null,
      assignee: null,
      label: null,
      overdue: false,
    })
  }

  const handleWipLimitChange = (columnId: keyof WipLimits, value: number | null) => {
    const newLimits = { ...wipLimits, [columnId]: value }
    setLocalWipLimits(newLimits)
    onWipLimitsChange?.(newLimits)
  }

  const filteredCalsticks = applyQuickFilters(filterAutoHiddenTasks(calsticks))

  const columns = [
    {
      id: "todo",
      title: "To Do",
      tasks: filteredCalsticks.filter((cs) => cs.calstick_status === "todo" || !cs.calstick_status),
      color: "bg-slate-50",
    },
    {
      id: "in-progress",
      title: "In Progress",
      tasks: filteredCalsticks.filter((cs) => cs.calstick_status === "in-progress"),
      color: "bg-blue-50",
    },
    {
      id: "in-review",
      title: "In Review",
      tasks: filteredCalsticks.filter((cs) => cs.calstick_status === "in-review"),
      color: "bg-purple-50",
    },
    {
      id: "done",
      title: "Done",
      tasks: filteredCalsticks.filter((cs) => cs.calstick_status === "done" || cs.calstick_completed),
      color: "bg-green-50",
    },
    {
      id: "blocked",
      title: "Blocked",
      tasks: filteredCalsticks.filter((cs) => cs.calstick_status === "blocked"),
      color: "bg-red-50",
    },
  ]

  // Group tasks by swimlane if enabled
  const getSwimlanes = () => {
    if (swimlaneGroupBy === "none") return null

    const lanes = new Map<string, { id: string; name: string; tasks: CalStick[] }>()

    filteredCalsticks.forEach((task) => {
      let laneId: string
      let laneName: string

      switch (swimlaneGroupBy) {
        case "assignee":
          laneId = task.assignee?.id || task.calstick_assignee_id || "unassigned"
          laneName = task.assignee?.username || task.assignee?.full_name || "Unassigned"
          break
        case "priority":
          laneId = task.calstick_priority || "none"
          laneName = (task.calstick_priority || "No Priority").charAt(0).toUpperCase() + (task.calstick_priority || "no priority").slice(1)
          break
        case "project":
          laneId = task.stick?.pad?.id || "no-project"
          laneName = task.stick?.pad?.name || "No Project"
          break
        default:
          return
      }

      if (!lanes.has(laneId)) {
        lanes.set(laneId, { id: laneId, name: laneName, tasks: [] })
      }
      lanes.get(laneId)!.tasks.push(task)
    })

    // Sort lanes
    const sortedLanes = Array.from(lanes.values())
    if (swimlaneGroupBy === "priority") {
      const priorityOrder = ["urgent", "high", "medium", "low", "none"]
      sortedLanes.sort((a, b) => priorityOrder.indexOf(a.id) - priorityOrder.indexOf(b.id))
    } else {
      sortedLanes.sort((a, b) => a.name.localeCompare(b.name))
    }

    return sortedLanes
  }

  const swimlanes = getSwimlanes()

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const activeTask = filteredCalsticks.find((cs) => cs.id === active.id)
    if (!activeTask) {
      setActiveId(null)
      return
    }

    let newStatus = over.id as string
    const overTask = filteredCalsticks.find((cs) => cs.id === over.id)

    if (overTask) {
      newStatus = overTask.calstick_status || "todo"
    } else {
      const validColumns = ["todo", "in-progress", "in-review", "done", "blocked"]
      if (!validColumns.includes(newStatus)) {
        setActiveId(null)
        return
      }
    }

    if (activeTask.calstick_status !== newStatus) {
      onUpdateStatus(activeTask.id, newStatus)
    }

    setActiveId(null)
  }

  const handleUnarchive = async (taskId: string) => {
    const response = await fetch(`/api/calsticks/archive?taskId=${taskId}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to unarchive task")
    }
  }

  const activeTask = activeId ? filteredCalsticks.find((cs) => cs.id === activeId) : null

  // Render columns for a specific set of tasks (used for swimlanes)
  const renderColumns = (tasks: CalStick[]) => {
    const cols = [
      {
        id: "todo",
        title: "To Do",
        tasks: tasks.filter((cs) => cs.calstick_status === "todo" || !cs.calstick_status),
        color: "bg-slate-50",
      },
      {
        id: "in-progress",
        title: "In Progress",
        tasks: tasks.filter((cs) => cs.calstick_status === "in-progress"),
        color: "bg-blue-50",
      },
      {
        id: "in-review",
        title: "In Review",
        tasks: tasks.filter((cs) => cs.calstick_status === "in-review"),
        color: "bg-purple-50",
      },
      {
        id: "done",
        title: "Done",
        tasks: tasks.filter((cs) => cs.calstick_status === "done" || cs.calstick_completed),
        color: "bg-green-50",
      },
      {
        id: "blocked",
        title: "Blocked",
        tasks: tasks.filter((cs) => cs.calstick_status === "blocked"),
        color: "bg-red-50",
      },
    ]

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cols.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            onToggleComplete={onToggleComplete}
            onStickClick={onStickClick}
            autoArchiveDays={autoArchiveDays}
            wipLimit={wipLimits[column.id as keyof WipLimits]}
            showAging={showAging}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Kanban Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filters:</span>
        </div>

        {/* Priority Filter */}
        <Select
          value={quickFilters.priority || "all"}
          onValueChange={(value) => setQuickFilters((prev) => ({ ...prev, priority: value === "all" ? null : value }))}
        >
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {uniquePriorities.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assignee Filter */}
        {uniqueAssignees.length > 0 && (
          <Select
            value={quickFilters.assignee || "all"}
            onValueChange={(value) => setQuickFilters((prev) => ({ ...prev, assignee: value === "all" ? null : value }))}
          >
            <SelectTrigger className="w-[140px] h-8">
              <Users className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {uniqueAssignees.map((assignee) => (
                <SelectItem key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Label Filter */}
        {uniqueLabels.length > 0 && (
          <Select
            value={quickFilters.label || "all"}
            onValueChange={(value) => setQuickFilters((prev) => ({ ...prev, label: value === "all" ? null : value }))}
          >
            <SelectTrigger className="w-[130px] h-8">
              <Tag className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Labels</SelectItem>
              {uniqueLabels.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Overdue Toggle */}
        <Button
          variant={quickFilters.overdue ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setQuickFilters((prev) => ({ ...prev, overdue: !prev.overdue }))}
        >
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8" onClick={clearAllFilters}>
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* Swimlane Grouping */}
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          <Select
            value={swimlaneGroupBy}
            onValueChange={(value) => {
              setLocalSwimlaneGroupBy(value as SwimlaneGroupBy)
              onSwimlaneGroupByChange?.(value as SwimlaneGroupBy)
            }}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="assignee">By Assignee</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
              <SelectItem value="project">By Project</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Card Aging Toggle */}
        <Button
          variant={showAging ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setShowAging(!showAging)}
          title="Show how long cards have been in their current column"
        >
          <Clock className="h-3 w-3 mr-1" />
          Aging
        </Button>

        {/* WIP Settings */}
        <Popover open={showWipSettings} onOpenChange={setShowWipSettings}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Settings2 className="h-3 w-3 mr-1" />
              WIP Limits
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Work In Progress Limits</h4>
              <p className="text-xs text-muted-foreground">
                Set maximum cards per column. Leave empty for no limit.
              </p>
              {(["todo", "in-progress", "in-review", "done", "blocked"] as const).map((colId) => (
                <div key={colId} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{colId.replace("-", " ")}</span>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8"
                    placeholder="∞"
                    value={wipLimits[colId] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number.parseInt(e.target.value, 10)
                      handleWipLimitChange(colId, val)
                    }}
                  />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Render swimlanes or regular columns */}
        {swimlanes ? (
          <div className="space-y-6">
            {swimlanes.map((lane) => (
              <div key={lane.id} className="border rounded-lg p-4 bg-background">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  {swimlaneGroupBy === "assignee" && <Users className="h-4 w-4" />}
                  {swimlaneGroupBy === "priority" && <AlertCircle className="h-4 w-4" />}
                  {swimlaneGroupBy === "project" && <Folder className="h-4 w-4" />}
                  {lane.name}
                  <Badge variant="secondary" className="ml-2">{lane.tasks.length}</Badge>
                </h3>
                {renderColumns(lane.tasks)}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onToggleComplete={onToggleComplete}
                onStickClick={onStickClick}
                autoArchiveDays={autoArchiveDays}
                wipLimit={wipLimits[column.id as keyof WipLimits]}
                showAging={showAging}
              />
            ))}
          </div>
        )}

        <DragOverlay className="cursor-grabbing pointer-events-none">
          {activeTask ? (
            <Card
              className="border-l-4 opacity-90 shadow-lg"
              style={{ borderLeftColor: activeTask.color || "#6b7280" }}
            >
              <CardHeader className="pb-3 pt-3 px-4">
                <h4 className="text-sm font-medium">{activeTask.content || activeTask.stick?.topic || "Untitled"}</h4>
              </CardHeader>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ArchivedTasksDialog open={showArchived} onOpenChange={setShowArchived} onUnarchive={handleUnarchive} />
    </>
  )
}

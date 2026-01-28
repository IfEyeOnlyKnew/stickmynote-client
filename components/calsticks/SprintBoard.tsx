"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Target,
  Calendar,
  MoreVertical,
  Play,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  GripVertical,
  MessageSquare,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO, differenceInDays, isAfter, isBefore } from "date-fns"
import type { Sprint, SprintStatus } from "@/types/sprint"
import type { CalStick } from "@/types/calstick"
import { DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { SprintRetrospective } from "./SprintRetrospective"

interface SprintBoardProps {
  readonly onTaskClick?: (task: CalStick) => void
  readonly refreshTrigger?: number
}

interface TaskCardProps {
  readonly task: CalStick
  readonly isDragging?: boolean
  readonly onClick?: () => void
}

function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow w-full text-left"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {task.calstick_priority && (
              <div
                className={`w-2 h-2 rounded-full ${priorityColors[task.calstick_priority] || "bg-gray-400"}`}
              />
            )}
            <span className="font-medium text-sm truncate">{task.content}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task.story_points !== null && task.story_points !== undefined && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {task.story_points} SP
              </Badge>
            )}
            {task.calstick_status && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {task.calstick_status}
              </Badge>
            )}
            {task.calstick_completed && (
              <CheckCircle className="h-3 w-3 text-green-500" />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

interface SprintColumnProps {
  readonly sprint: Sprint | null
  readonly tasks: CalStick[]
  readonly title: string
  readonly isBacklog?: boolean
  readonly onTaskClick?: (task: CalStick) => void
  readonly onSprintAction?: (action: string, sprint: Sprint) => void
}

function SprintColumn({
  sprint,
  tasks,
  title,
  isBacklog,
  onTaskClick,
  onSprintAction,
}: SprintColumnProps) {
  const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0)
  const completedPoints = tasks
    .filter((t) => t.calstick_completed)
    .reduce((sum, t) => sum + (t.story_points || 0), 0)
  const progressPercent = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0

  const getStatusIcon = (status: SprintStatus) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-green-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Target className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getDaysInfo = () => {
    if (!sprint) return null
    const start = parseISO(sprint.start_date)
    const end = parseISO(sprint.end_date)
    const today = new Date()

    if (sprint.status === "completed") {
      return <span className="text-muted-foreground">Completed</span>
    }

    if (isBefore(today, start)) {
      const daysUntil = differenceInDays(start, today)
      return <span className="text-muted-foreground">Starts in {daysUntil} days</span>
    }

    if (isAfter(today, end)) {
      return <span className="text-red-500">Overdue</span>
    }

    const daysRemaining = differenceInDays(end, today)
    return <span className="text-orange-500">{daysRemaining} days left</span>
  }

  return (
    <Card className="flex-shrink-0 w-[320px] flex flex-col max-h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {sprint ? getStatusIcon(sprint.status) : <Target className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {sprint && onSprintAction && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sprint.status === "planning" && (
                  <DropdownMenuItem onClick={() => onSprintAction("start", sprint)}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Sprint
                  </DropdownMenuItem>
                )}
                {sprint.status === "active" && (
                  <DropdownMenuItem onClick={() => onSprintAction("complete", sprint)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Sprint
                  </DropdownMenuItem>
                )}
                {(sprint.status === "active" || sprint.status === "completed") && (
                  <DropdownMenuItem onClick={() => onSprintAction("retrospective", sprint)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Retrospective
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onSprintAction("edit", sprint)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Sprint
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onSprintAction("delete", sprint)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Sprint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {sprint && (
          <CardDescription className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3" />
            {format(parseISO(sprint.start_date), "MMM d")} - {format(parseISO(sprint.end_date), "MMM d")}
            <span className="mx-1">•</span>
            {getDaysInfo()}
          </CardDescription>
        )}
        {isBacklog && (
          <CardDescription className="text-xs">
            Tasks not assigned to any sprint
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pb-2">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">
            {tasks.length} tasks • {totalPoints} points
          </span>
          {!isBacklog && (
            <span className="font-medium">
              {completedPoints}/{totalPoints} SP
            </span>
          )}
        </div>
        {!isBacklog && totalPoints > 0 && (
          <Progress value={progressPercent} className="h-1.5 mb-3" />
        )}
        <ScrollArea className="h-[calc(100%-40px)]">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
              />
            ))}
          </SortableContext>
          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {isBacklog ? "No tasks in backlog" : "Drag tasks here to add to sprint"}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function SprintBoard({ onTaskClick, refreshTrigger }: SprintBoardProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tasks, setTasks] = useState<CalStick[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<CalStick | null>(null)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [editFormData, setEditFormData] = useState({ name: "", goal: "" })
  const [saving, setSaving] = useState(false)
  const [retrospectiveSprint, setRetrospectiveSprint] = useState<Sprint | null>(null)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [sprintsRes, tasksRes] = await Promise.all([
        fetch("/api/calsticks/sprints?includeStats=true"),
        fetch("/api/calsticks?limit=500"),
      ])

      if (sprintsRes.ok) {
        const data = await sprintsRes.json()
        setSprints(data.sprints || [])
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.calsticks || [])
      }
    } catch (error) {
      console.error("Failed to fetch sprint board data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshTrigger])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event

    if (!over) return

    const taskId = active.id as string
    const targetId = over.id as string

    // Determine target sprint ID
    let newSprintId: string | null = null
    if (targetId === "backlog") {
      newSprintId = null
    } else if (sprints.some((s) => s.id === targetId)) {
      newSprintId = targetId
    } else {
      // Dropped on another task, find its sprint
      const targetTask = tasks.find((t) => t.id === targetId)
      if (targetTask) {
        newSprintId = targetTask.sprint_id || null
      }
    }

    // Update task's sprint_id
    try {
      const response = await fetch(`/api/calsticks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprint_id: newSprintId }),
      })

      if (response.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, sprint_id: newSprintId } : t
          )
        )
      }
    } catch (error) {
      console.error("Failed to update task sprint:", error)
      toast({
        title: "Error",
        description: "Failed to move task to sprint",
        variant: "destructive",
      })
    }
  }

  const handleSprintAction = async (action: string, sprint: Sprint) => {
    if (action === "edit") {
      setEditingSprint(sprint)
      setEditFormData({ name: sprint.name, goal: sprint.goal || "" })
      return
    }

    if (action === "retrospective") {
      setRetrospectiveSprint(sprint)
      return
    }

    if (action === "delete") {
      if (!confirm(`Are you sure you want to delete "${sprint.name}"? Tasks will be moved to backlog.`)) {
        return
      }
      try {
        const response = await fetch(`/api/calsticks/sprints/${sprint.id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          setSprints((prev) => prev.filter((s) => s.id !== sprint.id))
          setTasks((prev) =>
            prev.map((t) =>
              t.sprint_id === sprint.id ? { ...t, sprint_id: null } : t
            )
          )
          toast({
            title: "Sprint deleted",
            description: `Sprint "${sprint.name}" has been deleted`,
          })
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to delete sprint",
          variant: "destructive",
        })
      }
      return
    }

    // Start or complete sprint
    const newStatus: SprintStatus = action === "start" ? "active" : "completed"
    try {
      const response = await fetch(`/api/calsticks/sprints/${sprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const data = await response.json()
        setSprints((prev) =>
          prev.map((s) => (s.id === sprint.id ? data.sprint : s))
        )
        toast({
          title: action === "start" ? "Sprint started" : "Sprint completed",
          description: `Sprint "${sprint.name}" is now ${newStatus}`,
        })
      }
    } catch {
      toast({
        title: "Error",
        description: `Failed to ${action} sprint`,
        variant: "destructive",
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!editingSprint) return

    try {
      setSaving(true)
      const response = await fetch(`/api/calsticks/sprints/${editingSprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      })

      if (response.ok) {
        const data = await response.json()
        setSprints((prev) =>
          prev.map((s) => (s.id === editingSprint.id ? data.sprint : s))
        )
        setEditingSprint(null)
        toast({
          title: "Sprint updated",
          description: "Sprint details have been saved",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update sprint",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Group tasks by sprint
  const backlogTasks = tasks.filter((t) => !t.sprint_id && !t.calstick_completed)
  const getSprintTasks = (sprintId: string) =>
    tasks.filter((t) => t.sprint_id === sprintId)

  // Sort sprints: active first, then planning, then completed
  const sortedSprints = [...sprints].sort((a, b) => {
    const order: Record<SprintStatus, number> = {
      active: 0,
      planning: 1,
      completed: 2,
      cancelled: 3,
    }
    return order[a.status] - order[b.status]
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-300px)]">
          <SprintColumn
            sprint={null}
            tasks={backlogTasks}
            title="Backlog"
            isBacklog
            onTaskClick={onTaskClick}
          />
          {sortedSprints.map((sprint) => (
            <SprintColumn
              key={sprint.id}
              sprint={sprint}
              tasks={getSprintTasks(sprint.id)}
              title={sprint.name}
              onTaskClick={onTaskClick}
              onSprintAction={handleSprintAction}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!editingSprint} onOpenChange={() => setEditingSprint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sprint</DialogTitle>
            <DialogDescription>Update the sprint details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Sprint Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-goal">Sprint Goal</Label>
              <Input
                id="edit-goal"
                value={editFormData.goal}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, goal: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSprint(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sprint Retrospective Dialog */}
      <Dialog open={!!retrospectiveSprint} onOpenChange={() => setRetrospectiveSprint(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
          {retrospectiveSprint && (
            <SprintRetrospective
              sprintId={retrospectiveSprint.id}
              sprint={retrospectiveSprint}
              onClose={() => setRetrospectiveSprint(null)}
              className="h-[85vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

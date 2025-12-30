"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Clock, User, AlertCircle, GripVertical, Archive } from "lucide-react"
import { format, parseISO, isPast, isToday, differenceInDays } from "date-fns"
import type { CalStick } from "@/types/calstick"
// import { DoneColumnSettings } from "./DoneColumnSettings"
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

interface KanbanViewProps {
  calsticks: CalStick[]
  onToggleComplete: (id: string, completed: boolean) => void
  onUpdateStatus: (id: string, status: string) => void
  onStickClick: (calstick: CalStick) => void
  autoArchiveDays?: number
}

function SortableTaskCard({
  task,
  onToggleComplete,
  onStickClick,
  autoArchiveDays,
}: {
  task: CalStick
  onToggleComplete: (id: string, completed: boolean) => void
  onStickClick: (task: CalStick) => void
  autoArchiveDays?: number
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

  const isOverdue =
    task.calstick_date &&
    isPast(parseISO(task.calstick_date)) &&
    !task.calstick_completed &&
    !isToday(parseISO(task.calstick_date))
  const isDueToday = task.calstick_date && isToday(parseISO(task.calstick_date)) && !task.calstick_completed
  const creatorName = task.user?.username || task.user?.full_name || task.user?.email || "Unknown"

  const daysUntilArchive =
    task.calstick_completed && task.calstick_completed_at && autoArchiveDays
      ? autoArchiveDays - differenceInDays(new Date(), parseISO(task.calstick_completed_at))
      : null

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
      className="mb-3 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] border-l-4"
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
              variant={isOverdue ? "destructive" : isDueToday ? "default" : "outline"}
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
          {daysUntilArchive !== null && daysUntilArchive > 0 && daysUntilArchive <= 7 && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-600 border-amber-300">
              <Archive className="h-3 w-3" />
              {daysUntilArchive}d
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <User className="h-3 w-3" />
            {creatorName}
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
}: {
  column: { id: string; title: string; tasks: CalStick[]; color: string }
  onToggleComplete: (id: string, completed: boolean) => void
  onStickClick: (task: CalStick) => void
  autoArchiveDays?: number
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  })

  return (
    <div ref={setNodeRef} className={`rounded-lg ${column.color} p-4 min-h-[500px]`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">{column.title}</h3>
        <Badge variant="secondary" className="text-xs">
          {column.tasks.length}
        </Badge>
      </div>
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
}: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

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

  const filteredCalsticks = filterAutoHiddenTasks(calsticks)

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

  const handleArchiveAll = async () => {
    const response = await fetch("/api/calsticks/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveAll: true }),
    })

    if (!response.ok) {
      throw new Error("Failed to archive tasks")
    }

    window.location.reload()
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

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onToggleComplete={onToggleComplete}
              onStickClick={onStickClick}
              autoArchiveDays={autoArchiveDays}
            />
          ))}
        </div>
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

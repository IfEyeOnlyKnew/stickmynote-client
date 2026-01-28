"use client"

import { useDroppable, useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { format, parseISO, getHours } from "date-fns"
import { CheckCircle2, Circle, GripVertical } from "lucide-react"
import type { CalStick } from "@/types/calstick"

interface TimeBlockProps {
  readonly date: Date
  readonly hour: number
  readonly tasks: CalStick[]
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onStickClick: (calstick: CalStick) => void
  readonly fullWidth?: boolean
}

interface DraggableTaskProps {
  readonly task: CalStick
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onStickClick: (calstick: CalStick) => void
}

export function TimeBlock({ date, hour, tasks, onToggleComplete, onStickClick, fullWidth = false }: TimeBlockProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `time-slot-${format(date, "yyyy-MM-dd")}-${hour}`,
    data: {
      date,
      hour,
    },
  })

  const scheduledTasks = tasks.filter((task) => {
    if (!task.calstick_start_time) return false
    const taskHour = getHours(parseISO(task.calstick_start_time))
    return taskHour === hour
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative border-l p-1 ${isOver ? "bg-primary/10" : ""} ${fullWidth ? "flex-1" : ""} hover:bg-muted/30 transition-colors`}
    >
      <div className="space-y-1">
        {scheduledTasks.map((task) => (
          <DraggableTask key={task.id} task={task} onToggleComplete={onToggleComplete} onStickClick={onStickClick} />
        ))}
      </div>
    </div>
  )
}

function DraggableTask({ task, onToggleComplete, onStickClick }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: {
      task,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded p-1.5 hover:shadow-md transition-all border-l-3"
    >
      <div
        className="absolute inset-0 rounded"
        style={{ backgroundColor: task.color + "20", borderLeft: `3px solid ${task.color}` }}
      />
      <div className="relative flex items-start gap-1.5">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3 text-gray-400" />
        </div>
        <button
          type="button"
          onClick={() => onToggleComplete(task.id, task.calstick_completed)}
          className="flex-shrink-0"
          aria-label={task.calstick_completed ? "Mark as incomplete" : "Mark as complete"}
        >
          {task.calstick_completed ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Circle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
          )}
        </button>
        <button
          type="button"
          className="flex-1 min-w-0 text-left cursor-pointer"
          onClick={() => onStickClick(task)}
        >
          <div
            className={`text-xs font-medium truncate ${task.calstick_completed ? "line-through text-gray-500" : ""}`}
          >
            {task.content || task.stick?.topic || "Untitled"}
          </div>
          {task.calstick_start_time && task.calstick_end_time && (
            <div className="text-[10px] text-muted-foreground">
              {format(parseISO(task.calstick_start_time), "h:mm")} -{" "}
              {format(parseISO(task.calstick_end_time), "h:mm a")}
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

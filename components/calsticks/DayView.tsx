"use client"

import { useMemo, useState } from "react"
import { format, parseISO, setHours, setMinutes } from "date-fns"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Circle, Clock } from "lucide-react"
import type { CalStick } from "@/types/calstick"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { TimeBlock } from "./TimeBlock"

interface DayViewProps {
  currentDay: Date
  calsticks: CalStick[]
  onToggleComplete: (id: string, completed: boolean) => void
  onStickClick: (calstick: CalStick) => void
  onUpdateDate: (id: string, date: Date | undefined) => void
  onUpdateTime?: (id: string, startTime: Date, endTime: Date) => void
}

export function DayView({
  currentDay,
  calsticks,
  onToggleComplete,
  onStickClick,
  onUpdateDate,
  onUpdateTime,
}: Readonly<DayViewProps>) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const dayTasks = useMemo(() => {
    const dateKey = format(currentDay, "yyyy-MM-dd")
    return calsticks.filter((cs) => {
      if (!cs.calstick_date) return false
      return format(parseISO(cs.calstick_date), "yyyy-MM-dd") === dateKey
    })
  }, [calsticks, currentDay])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const taskId = active.id as string
    const dropData = over.data.current as { date: Date; hour: number }

    if (dropData && onUpdateDate && onUpdateTime) {
      const startTime = setHours(setMinutes(dropData.date, 0), dropData.hour)
      const endTime = setHours(setMinutes(dropData.date, 0), dropData.hour + 1)

      onUpdateDate(taskId, dropData.date)
      onUpdateTime(taskId, startTime, endTime)
    }

    setActiveId(null)
  }

  const activeTask = activeId ? calsticks.find((cs) => cs.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hourly Schedule
          </h3>
          <div className="border rounded-lg overflow-hidden">
            {hours.map((hour) => (
              <div key={hour} className="border-b last:border-b-0 min-h-[80px] flex">
                <div className="w-20 p-3 text-sm font-medium text-muted-foreground border-r bg-muted/30">
                  {format(setHours(new Date(), hour), "h:mm a")}
                </div>
                <TimeBlock
                  date={currentDay}
                  hour={hour}
                  tasks={dayTasks}
                  onToggleComplete={onToggleComplete}
                  onStickClick={onStickClick}
                  fullWidth
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">All Tasks ({dayTasks.length})</h3>
          <div className="space-y-2">
            {dayTasks.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No tasks scheduled for this day</Card>
            ) : (
              dayTasks.map((task) => (
                <Card
                  key={task.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-all border-l-4"
                  style={{ borderLeftColor: task.color }}
                  onClick={() => onStickClick(task)}
                >
                  <div className="flex items-start gap-3">
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
                      <h4 className={`font-medium ${task.calstick_completed ? "line-through text-gray-500" : ""}`}>
                        {task.content || task.stick?.topic || "Untitled"}
                      </h4>
                      {task.stick?.topic && task.content && (
                        <p className="text-sm text-muted-foreground line-clamp-1">Topic: {task.stick.topic}</p>
                      )}
                      {task.calstick_start_time && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(task.calstick_start_time), "h:mm a")}
                          {task.calstick_end_time && ` - ${format(parseISO(task.calstick_end_time), "h:mm a")}`}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <Card className="p-2 shadow-lg opacity-90 border-l-4" style={{ borderLeftColor: activeTask.color }}>
            <div className="flex items-center gap-2">
              {activeTask.calstick_completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
              <span className="text-sm font-medium truncate">{activeTask.content || activeTask.stick?.topic || "Untitled"}</span>
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

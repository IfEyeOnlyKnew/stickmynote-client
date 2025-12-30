"use client"

import { useMemo, useState } from "react"
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isToday, setHours, setMinutes } from "date-fns"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Circle } from "lucide-react"
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

interface WeekViewProps {
  currentWeek: Date
  calsticks: CalStick[]
  onToggleComplete: (id: string, completed: boolean) => void
  onStickClick: (calstick: CalStick) => void
  onUpdateDate: (id: string, date: Date | undefined) => void
  onUpdateTime?: (id: string, startTime: Date, endTime: Date) => void
}

export function WeekView({
  currentWeek,
  calsticks,
  onToggleComplete,
  onStickClick,
  onUpdateDate,
  onUpdateTime,
}: WeekViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const weekStart = startOfWeek(currentWeek)
  const weekEnd = endOfWeek(currentWeek)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalStick[]>()
    calsticks.forEach((cs) => {
      if (cs.calstick_date) {
        const dateKey = format(parseISO(cs.calstick_date), "yyyy-MM-dd")
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)?.push(cs)
      }
    })
    return map
  }, [calsticks])

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
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-xs font-medium text-muted-foreground">Time</div>
            {weekDays.map((day) => (
              <div key={day.toString()} className={`p-2 text-center border-l ${isToday(day) ? "bg-primary/5" : ""}`}>
                <div className="text-xs font-medium text-muted-foreground">{format(day, "EEE")}</div>
                <div className={`text-lg font-bold ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d")}</div>
              </div>
            ))}
          </div>

          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b min-h-[60px]">
                <div className="p-2 text-xs text-muted-foreground border-r">
                  {format(setHours(new Date(), hour), "ha")}
                </div>
                {weekDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd")
                  const dayTasks = tasksByDate.get(dateKey) || []

                  return (
                    <TimeBlock
                      key={`${day.toString()}-${hour}`}
                      date={day}
                      hour={hour}
                      tasks={dayTasks}
                      onToggleComplete={onToggleComplete}
                      onStickClick={onStickClick}
                    />
                  )
                })}
              </div>
            ))}
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

"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns"
import type { CalStick } from "@/types/calstick"
import { WeekView } from "./WeekView"
import { DayView } from "./DayView"

interface CalendarViewProps {
  readonly calsticks: CalStick[]
  readonly onToggleComplete: (id: string, completed: boolean) => void
  readonly onUpdateDate: (id: string, date: Date | undefined) => void
  readonly onStickClick: (calstick: CalStick) => void
  readonly onUpdateTime?: (id: string, startTime: Date, endTime: Date) => void
}

export function CalendarView({
  calsticks,
  onToggleComplete,
  onStickClick,
  onUpdateDate,
  onUpdateTime,
}: Readonly<CalendarViewProps>) {
  type CalendarViewMode = "month" | "week" | "day"
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [currentDay, setCurrentDay] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

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

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const previousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1))
  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))
  const previousDay = () => setCurrentDay(subDays(currentDay, 1))
  const nextDay = () => setCurrentDay(addDays(currentDay, 1))
  const today = () => {
    const now = new Date()
    setCurrentMonth(now)
    setCurrentWeek(now)
    setCurrentDay(now)
  }

  const handlePrevious = () => {
    if (viewMode === "month") previousMonth()
    else if (viewMode === "week") previousWeek()
    else previousDay()
  }

  const handleNext = () => {
    if (viewMode === "month") nextMonth()
    else if (viewMode === "week") nextWeek()
    else nextDay()
  }

  const getViewTitle = () => {
    if (viewMode === "month") return format(currentMonth, "MMMM yyyy")
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentWeek)
      const weekEnd = endOfWeek(currentWeek)
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
    }
    return format(currentDay, "EEEE, MMMM d, yyyy")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "week" | "day")}>
          <TabsList>
            <TabsTrigger value="month" className="gap-2">
              <Calendar className="h-4 w-4" />
              Month
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2">
              <Clock className="h-4 w-4" />
              Week
            </TabsTrigger>
            <TabsTrigger value="day" className="gap-2">
              <Clock className="h-4 w-4" />
              Day
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{getViewTitle()}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={today}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "week" && (
        <WeekView
          currentWeek={currentWeek}
          calsticks={calsticks}
          onToggleComplete={onToggleComplete}
          onStickClick={onStickClick}
          onUpdateDate={onUpdateDate}
          onUpdateTime={onUpdateTime}
        />
      )}

      {viewMode === "day" && (
        <DayView
          currentDay={currentDay}
          calsticks={calsticks}
          onToggleComplete={onToggleComplete}
          onStickClick={onStickClick}
          onUpdateDate={onUpdateDate}
          onUpdateTime={onUpdateTime}
        />
      )}

      {viewMode === "month" && (
        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd")
            const dayTasks = tasksByDate.get(dateKey) || []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDate = isToday(day)

            return (
              <Card
                key={day.toString()}
                className={`min-h-[120px] ${isCurrentMonth ? "" : "opacity-40"} ${
                  isTodayDate ? "border-primary border-2" : ""
                }`}
              >
                <CardContent className="p-2">
                  <div className={`text-sm font-medium mb-1 ${isTodayDate ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((cs) => (
                      <button
                        key={cs.id}
                        type="button"
                        className="text-xs p-1 rounded cursor-pointer hover:shadow-sm transition-shadow truncate w-full text-left"
                        style={{ backgroundColor: cs.color + "20", borderLeft: `3px solid ${cs.color}` }}
                        onClick={() => onStickClick(cs)}
                        aria-label={`Open task: ${cs.content || cs.stick?.topic || "Untitled"}`}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleComplete(cs.id, cs.calstick_completed)
                            }}
                            aria-label={cs.calstick_completed ? "Mark task as incomplete" : "Mark task as complete"}
                          >
                            {cs.calstick_completed ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                            ) : (
                              <Circle className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            )}
                          </button>
                          <span className={`truncate ${cs.calstick_completed ? "line-through" : ""}`}>
                            {cs.content || cs.stick?.topic || "Untitled"}
                          </span>
                        </div>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">+{dayTasks.length - 3} more</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

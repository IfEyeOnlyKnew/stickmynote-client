"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { CheckCircle2, Circle, Clock, Edit2, Save, X, BarChart3, User, CalendarIcon } from "lucide-react"
import { format, parseISO, isPast, isToday, isTomorrow, differenceInDays } from "date-fns"
import type { CalStick } from "@/types/calstick"
import { TaskProgressIndicator } from "@/components/calsticks/TaskProgressIndicator"
import { useState, useEffect, useRef } from "react"
import type { TaskProgress } from "@/types/checklist"
import { NLQueryBar } from "@/components/ai/NLQueryBar"
import { useVirtualizer } from "@tanstack/react-virtual"

interface ListViewProps {
  calsticks: CalStick[]
  onToggleComplete: (id: string, completed: boolean) => void
  onUpdateDate: (id: string, date: Date | undefined) => void
  onStickClick: (calstick: CalStick) => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  editDate: Date | undefined
  setEditDate: (date: Date | undefined) => void
  openGanttChart: (stickId: string) => void
  autoArchiveDays?: number
}

interface GroupedCalSticks {
  [key: string]: CalStick[]
}

export function ListView({
  calsticks,
  onToggleComplete,
  onUpdateDate,
  onStickClick,
  editingId,
  setEditingId,
  editDate,
  setEditDate,
  openGanttChart,
  autoArchiveDays = 14,
}: ListViewProps) {
  const [taskProgress, setTaskProgress] = useState<Record<string, TaskProgress>>({})
  const [aiFilters, setAiFilters] = useState<Record<string, unknown>>({})
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    calsticks.forEach((cs) => {
      fetchTaskProgress(cs.id)
    })
  }, [calsticks])

  const fetchTaskProgress = async (taskId: string) => {
    try {
      const response = await fetch(`/api/calsticks/${taskId}/progress`)
      if (response.ok) {
        const data = await response.json()
        setTaskProgress((prev) => ({ ...prev, [taskId]: data.progress }))
      }
    } catch (error) {
      console.error("Error fetching task progress:", error)
    }
  }

  const filterAutoHiddenTasks = (tasks: CalStick[]): CalStick[] => {
    if (autoArchiveDays === 0) return tasks

    return tasks.filter((task) => {
      if (!task.calstick_completed || !task.calstick_completed_at) return true
      if (task.is_archived) return false
      const daysSinceCompleted = differenceInDays(new Date(), parseISO(task.calstick_completed_at))
      return daysSinceCompleted < autoArchiveDays
    })
  }

  const matchesPriorityFilter = (stick: CalStick): boolean => {
    return !aiFilters.priority || stick.calstick_priority === aiFilters.priority
  }

  const matchesStatusFilter = (stick: CalStick): boolean => {
    return !aiFilters.status || stick.calstick_status === aiFilters.status
  }

  const matchesCompletedFilter = (stick: CalStick): boolean => {
    return aiFilters.isCompleted === undefined || stick.calstick_completed === aiFilters.isCompleted
  }

  const matchesSearchFilter = (stick: CalStick): boolean => {
    if (!aiFilters.search || typeof aiFilters.search !== "string") return true
    const term = aiFilters.search.toLowerCase()
    const contentMatch = stick.content.toLowerCase().includes(term)
    const topicMatch = stick.stick?.topic?.toLowerCase().includes(term) ?? false
    return contentMatch || topicMatch
  }

  const matchesTimeFrameFilter = (stick: CalStick): boolean => {
    if (!aiFilters.timeFrame || !stick.calstick_date) return true
    const date = parseISO(stick.calstick_date)
    
    switch (aiFilters.timeFrame) {
      case "overdue": return isPast(date) && !isToday(date)
      case "today": return isToday(date)
      case "tomorrow": return isTomorrow(date)
      default: return true
    }
  }

  const matchesAiFilters = (stick: CalStick): boolean => {
    return (
      matchesPriorityFilter(stick) &&
      matchesStatusFilter(stick) &&
      matchesCompletedFilter(stick) &&
      matchesSearchFilter(stick) &&
      matchesTimeFrameFilter(stick)
    )
  }

  const categorizeStick = (cs: CalStick, grouped: GroupedCalSticks): void => {
    if (!cs.calstick_date) {
      grouped["no-date"].push(cs)
      return
    }
    
    const date = parseISO(cs.calstick_date)
    if (isPast(date) && !isToday(date) && !cs.calstick_completed) {
      grouped.overdue.push(cs)
    } else if (isToday(date)) {
      grouped.today.push(cs)
    } else if (isTomorrow(date)) {
      grouped.tomorrow.push(cs)
    } else {
      grouped.upcoming.push(cs)
    }
  }

  const groupByDate = (calsticks: CalStick[]): GroupedCalSticks => {
    let filteredSticks = filterAutoHiddenTasks([...calsticks])

    if (Object.keys(aiFilters).length > 0) {
      filteredSticks = filteredSticks.filter(matchesAiFilters)
    }

    const grouped: GroupedCalSticks = {
      overdue: [],
      today: [],
      tomorrow: [],
      upcoming: [],
      "no-date": [],
    }

    filteredSticks.forEach((cs) => categorizeStick(cs, grouped))

    return grouped
  }

  const groupedCalSticks = groupByDate(calsticks)

  const flattenedItems = [
    ...(groupedCalSticks.overdue.length > 0
      ? [
          {
            type: "header" as const,
            title: "Overdue",
            count: groupedCalSticks.overdue.length,
            variant: "destructive" as const,
          },
          ...groupedCalSticks.overdue.map((cs) => ({ type: "item" as const, data: cs })),
        ]
      : []),
    ...(groupedCalSticks.today.length > 0
      ? [
          {
            type: "header" as const,
            title: "Today",
            count: groupedCalSticks.today.length,
            variant: "default" as const,
          },
          ...groupedCalSticks.today.map((cs) => ({ type: "item" as const, data: cs })),
        ]
      : []),
    ...(groupedCalSticks.tomorrow.length > 0
      ? [
          {
            type: "header" as const,
            title: "Tomorrow",
            count: groupedCalSticks.tomorrow.length,
            variant: "default" as const,
          },
          ...groupedCalSticks.tomorrow.map((cs) => ({ type: "item" as const, data: cs })),
        ]
      : []),
    ...(groupedCalSticks.upcoming.length > 0
      ? [
          {
            type: "header" as const,
            title: "Upcoming",
            count: groupedCalSticks.upcoming.length,
            variant: "secondary" as const,
          },
          ...groupedCalSticks.upcoming.map((cs) => ({ type: "item" as const, data: cs })),
        ]
      : []),
    ...(groupedCalSticks["no-date"].length > 0
      ? [
          {
            type: "header" as const,
            title: "No Date",
            count: groupedCalSticks["no-date"].length,
            variant: "secondary" as const,
          },
          ...groupedCalSticks["no-date"].map((cs) => ({ type: "item" as const, data: cs })),
        ]
      : []),
  ]

  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index]
      return item.type === "header" ? 60 : 160
    },
    overscan: 5,
  })

  const renderCalStickCard = (cs: CalStick) => {
    const isEditing = editingId === cs.id
    const creatorName = cs.user?.username || cs.user?.full_name || cs.user?.email || "Unknown User"
    const progress = taskProgress[cs.id]

    return (
      <Card
        key={cs.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => !isEditing && onStickClick(cs)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleComplete(cs.id, cs.calstick_completed)
                  }}
                  className="hover:scale-110 transition-transform"
                >
                  {cs.calstick_completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                <span className={cs.calstick_completed ? "line-through text-gray-500" : ""}>
                  {cs.content || cs.stick?.topic || "Untitled Stick"}
                </span>
              </CardTitle>
              {cs.stick?.topic && cs.content && (
                <p className="mt-1 text-sm text-muted-foreground">Topic: {cs.stick.topic}</p>
              )}
              {progress && <TaskProgressIndicator progress={progress} compact />}
            </div>
            <div className="flex items-center gap-2 ml-2">
              {isEditing ? (
                <div className="flex items-center gap-1" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {editDate ? format(editDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent mode="single" selected={editDate} onSelect={setEditDate} />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdateDate(cs.id, editDate)
                    }}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(null)
                      setEditDate(undefined)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  {cs.calstick_date && (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(parseISO(cs.calstick_date), "MMM d, yyyy")}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(cs.id)
                      setEditDate(cs.calstick_date ? parseISO(cs.calstick_date) : undefined)
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      openGanttChart(cs.stick_id)
                    }}
                    title="View Gantt Chart"
                  >
                    <BarChart3 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{cs.stick?.pad?.name || "No Pad"}</Badge>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="text-xs">{creatorName}</span>
            </div>
            {cs.calstick_completed && cs.calstick_completed_at && (
              <span className="text-xs">Completed {format(parseISO(cs.calstick_completed_at), "MMM d")}</span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <NLQueryBar onFiltersChange={setAiFilters} />
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = flattenedItems[virtualItem.index]

            return (
              <div
                key={String(virtualItem.key)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.type === "header" ? (
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <Badge variant={item.variant}>{item.count}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">{renderCalStickCard(item.data)}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

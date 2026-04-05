"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Video,
  MapPin,
  Users,
  Clock,
  Plus,
} from "lucide-react"
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks,
} from "date-fns"
import { cn } from "@/lib/utils"
import type { MeetingWithDetails } from "@/types/meeting"
import { MEETING_STATUS_COLORS } from "@/types/meeting"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CalendarQuickViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduleMeeting?: () => void
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CalendarQuickView({
  open,
  onOpenChange,
  onScheduleMeeting,
}: Readonly<CalendarQuickViewProps>) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Get week range
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate])
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate])
  const daysInWeek = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  )

  // Fetch meetings for the current week
  useEffect(() => {
    if (!open) return

    const fetchMeetings = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        })

        console.log("[CalendarQuickView] Fetching meetings:", {
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        })

        const response = await fetch(`/api/meetings?${params}`)
        console.log("[CalendarQuickView] Response status:", response.status)

        if (response.ok) {
          const data = await response.json()
          console.log("[CalendarQuickView] Meetings data:", data)
          setMeetings(data.meetings || [])
        } else {
          const errorData = await response.json()
          console.error("[CalendarQuickView] Error response:", errorData)
        }
      } catch (error) {
        console.error("[CalendarQuickView] Error fetching meetings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeetings()
  }, [open, weekStart, weekEnd])

  // Get meetings for a specific day
  const getMeetingsForDay = (date: Date) => {
    return meetings.filter((meeting) => isSameDay(new Date(meeting.start_time), date))
  }

  // Get meetings for selected date
  const selectedDayMeetings = useMemo(
    () => getMeetingsForDay(selectedDate),
    [selectedDate, meetings]
  )

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1))
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1))
  const handleToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-orange-500" />
            Calendar
          </DialogTitle>
          <DialogDescription>
            View your scheduled meetings for the week
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleToday}>
                Today
              </Button>
            </div>
            <span className="text-sm font-medium">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </span>
            {onScheduleMeeting && (
              <Button size="sm" onClick={onScheduleMeeting}>
                <Plus className="h-4 w-4 mr-1" />
                New Meeting
              </Button>
            )}
          </div>

          {/* Week View */}
          <div className="grid grid-cols-7 gap-1">
            {daysInWeek.map((day) => {
              const dayMeetings = getMeetingsForDay(day)
              const isSelected = isSameDay(day, selectedDate)
              const isCurrentDay = isToday(day)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg transition-colors",
                    "hover:bg-muted",
                    isSelected && "bg-primary text-primary-foreground",
                    isCurrentDay && !isSelected && "bg-orange-100 dark:bg-orange-900/30"
                  )}
                >
                  <span className="text-xs font-medium">
                    {format(day, "EEE")}
                  </span>
                  <span className={cn("text-lg font-semibold", isCurrentDay && !isSelected && "text-orange-600")}>
                    {format(day, "d")}
                  </span>
                  {dayMeetings.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayMeetings.slice(0, 3).map((meeting) => (
                        <div
                          key={meeting.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-primary"
                          )}
                        />
                      ))}
                      {dayMeetings.length > 3 && (
                        <span className="text-[10px]">+{dayMeetings.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Day Meetings */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">
              {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, MMMM d")}
              {selectedDayMeetings.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedDayMeetings.length} meeting{selectedDayMeetings.length === 1 ? "" : "s"}
                </Badge>
              )}
            </h3>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && selectedDayMeetings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No meetings scheduled</p>
                {onScheduleMeeting && (
                  <Button variant="link" size="sm" onClick={onScheduleMeeting}>
                    Schedule one now
                  </Button>
                )}
              </div>
            )}
            {!isLoading && selectedDayMeetings.length > 0 && (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {selectedDayMeetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Meeting Card Component
// ----------------------------------------------------------------------------

function MeetingCard({ meeting }: Readonly<{ meeting: MeetingWithDetails }>) {
  const startTime = new Date(meeting.start_time)
  const endTime = new Date(meeting.end_time)

  return (
    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{meeting.title}</h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{meeting.location}</span>
            </div>
          )}
          {meeting.attendees && meeting.attendees.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Users className="h-3.5 w-3.5" />
              <span>{meeting.attendees.length} attendees</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={MEETING_STATUS_COLORS[meeting.status]} variant="secondary">
            {meeting.status}
          </Badge>
          {meeting.video_room_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => window.open(meeting.video_room_url!, "_blank")}
            >
              <Video className="h-3.5 w-3.5 mr-1 text-blue-500" />
              Join
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

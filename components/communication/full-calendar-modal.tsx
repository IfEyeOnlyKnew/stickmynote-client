"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Video,
  MapPin,
  Users,
  Clock,
  Plus,
  X,
  UserSearch,
} from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns"
import { cn } from "@/lib/utils"
import type { MeetingWithDetails, AttendeeStatus } from "@/types/meeting"
import { MEETING_STATUS_COLORS, ATTENDEE_STATUS_COLORS } from "@/types/meeting"
import { VideoInviteUserSearch } from "@/components/video/VideoInviteUserSearch"
import { useCSRF } from "@/hooks/useCSRF"
import { useUser } from "@/contexts/user-context"
import { toast } from "sonner"

// Type for other users' busy times
interface BusyTime {
  id: string
  title: string
  start_time: string
  end_time: string
  is_organizer: boolean
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface FullCalendarModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduleMeeting?: (selectedDate?: Date) => void
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function FullCalendarModal({
  open,
  onOpenChange,
  onScheduleMeeting,
}: FullCalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // User availability checking
  const [checkAvailabilityEmails, setCheckAvailabilityEmails] = useState<string[]>([])
  const [otherUsersBusyTimes, setOtherUsersBusyTimes] = useState<Record<string, BusyTime[]>>({})
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  // Get calendar grid dates (includes days from prev/next month to fill the grid)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  // Fetch meetings for the current month view
  useEffect(() => {
    if (!open) return

    const fetchMeetings = async () => {
      setIsLoading(true)
      try {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        // Extend range to include partial weeks shown in calendar
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

        const params = new URLSearchParams({
          start: calendarStart.toISOString(),
          end: calendarEnd.toISOString(),
        })

        console.log("[FullCalendar] Fetching meetings for:", {
          start: calendarStart.toISOString(),
          end: calendarEnd.toISOString(),
        })

        const response = await fetch(`/api/meetings?${params}`)

        if (response.ok) {
          const data = await response.json()
          console.log("[FullCalendar] Meetings loaded:", data.meetings?.length || 0)
          setMeetings(data.meetings || [])
        } else {
          console.error("[FullCalendar] Error response:", response.status)
        }
      } catch (error) {
        console.error("[FullCalendar] Error fetching meetings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeetings()
  }, [open, currentMonth])

  // Fetch other users' availability when emails are selected
  useEffect(() => {
    if (!open || checkAvailabilityEmails.length === 0) {
      setOtherUsersBusyTimes({})
      return
    }

    const fetchAvailability = async () => {
      setIsLoadingAvailability(true)
      try {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

        const params = new URLSearchParams({
          emails: checkAvailabilityEmails.join(","),
          start: calendarStart.toISOString(),
          end: calendarEnd.toISOString(),
        })

        console.log("[FullCalendar] Fetching availability for:", checkAvailabilityEmails)

        const response = await fetch(`/api/users/availability?${params}`)

        if (response.ok) {
          const data = await response.json()
          console.log("[FullCalendar] Availability loaded:", data)
          setOtherUsersBusyTimes(data.availability || {})
        } else {
          console.error("[FullCalendar] Availability error:", response.status)
        }
      } catch (error) {
        console.error("[FullCalendar] Error fetching availability:", error)
      } finally {
        setIsLoadingAvailability(false)
      }
    }

    fetchAvailability()
  }, [open, currentMonth, checkAvailabilityEmails])

  // Get meetings for a specific day
  const getMeetingsForDay = useCallback(
    (date: Date) => {
      return meetings.filter((meeting) =>
        isSameDay(new Date(meeting.start_time), date)
      )
    },
    [meetings]
  )

  // Get other users' busy times for a specific day
  const getOthersBusyTimesForDay = useCallback(
    (date: Date): { email: string; busyTime: BusyTime }[] => {
      const result: { email: string; busyTime: BusyTime }[] = []
      for (const [email, busyTimes] of Object.entries(otherUsersBusyTimes)) {
        for (const busyTime of busyTimes) {
          if (isSameDay(new Date(busyTime.start_time), date)) {
            result.push({ email, busyTime })
          }
        }
      }
      return result
    },
    [otherUsersBusyTimes]
  )

  // Get meetings for selected date
  const selectedDayMeetings = useMemo(
    () => (selectedDate ? getMeetingsForDay(selectedDate) : []),
    [selectedDate, getMeetingsForDay]
  )

  // Get other users' busy times for selected date
  const selectedDayOthersBusy = useMemo(
    () => (selectedDate ? getOthersBusyTimesForDay(selectedDate) : []),
    [selectedDate, getOthersBusyTimesForDay]
  )

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const handleToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
  }

  const handleScheduleOnDate = () => {
    if (onScheduleMeeting) {
      onScheduleMeeting(selectedDate || undefined)
    }
  }

  // Day names header
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-orange-500" />
              Calendar
            </DialogTitle>
            {onScheduleMeeting && (
              <Button size="sm" onClick={() => onScheduleMeeting()}>
                <Plus className="h-4 w-4 mr-1" />
                New Meeting
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Calendar Grid */}
          <div className="flex-1 p-4 border-r">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleToday}>
                  Today
                </Button>
              </div>
              <h2 className="text-lg font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
            </div>

            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Day names header */}
            <div className="grid grid-cols-7 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayMeetings = getMeetingsForDay(day)
                const othersBusy = getOthersBusyTimesForDay(day)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isCurrentDay = isToday(day)
                const hasConflict = othersBusy.length > 0

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "relative min-h-[70px] p-1 rounded-lg transition-colors text-left",
                      "hover:bg-muted border border-transparent",
                      isSelected && "bg-primary/10 border-primary",
                      !isCurrentMonth && "opacity-40",
                      isCurrentDay && !isSelected && "bg-orange-50 dark:bg-orange-950/20",
                      hasConflict && !isSelected && "ring-2 ring-red-300 dark:ring-red-700"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isCurrentDay && "text-orange-600 dark:text-orange-400",
                        isSelected && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {/* Meeting indicators */}
                    {dayMeetings.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayMeetings.slice(0, 2).map((meeting) => (
                          <div
                            key={meeting.id}
                            className={cn(
                              "text-[10px] truncate px-1 py-0.5 rounded",
                              "bg-primary/20 text-primary"
                            )}
                            title={meeting.title}
                          >
                            {format(new Date(meeting.start_time), "h:mm a")}
                          </div>
                        ))}
                        {dayMeetings.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayMeetings.length - 2} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Other users' busy indicators */}
                    {othersBusy.length > 0 && (
                      <div className="absolute top-1 right-1">
                        <div
                          className="w-2 h-2 rounded-full bg-red-500"
                          title={`${othersBusy.length} conflict(s)`}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Day Details Panel */}
          <div className="w-96 flex flex-col bg-muted/30">
            {/* Check Availability Section */}
            <Collapsible open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
              <div className="p-3 border-b bg-background">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                    <div className="flex items-center gap-2">
                      <UserSearch className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Check Availability</span>
                      {checkAvailabilityEmails.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {checkAvailabilityEmails.length}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      availabilityOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Find users to check their schedule</Label>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        LDAP
                      </span>
                    </div>
                    <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-2">
                      <VideoInviteUserSearch
                        selectedEmails={checkAvailabilityEmails}
                        onEmailsChange={setCheckAvailabilityEmails}
                      />
                    </div>
                    {isLoadingAvailability && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading availability...
                      </div>
                    )}
                    {checkAvailabilityEmails.length > 0 && !isLoadingAvailability && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">Red dot = user has meeting</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {selectedDate ? (
              <>
                <div className="p-4 border-b bg-background">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {format(selectedDate, "EEEE")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(selectedDate, "MMMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedDate(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {onScheduleMeeting && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={handleScheduleOnDate}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Schedule on this day
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-3">
                    {/* My Meetings */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        YOUR MEETINGS
                      </h4>
                      {selectedDayMeetings.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-sm">No meetings scheduled</p>
                        </div>
                      ) : (
                        selectedDayMeetings.map((meeting) => (
                          <MeetingCard key={meeting.id} meeting={meeting} />
                        ))
                      )}
                    </div>

                    {/* Other Users' Busy Times */}
                    {selectedDayOthersBusy.length > 0 && (
                      <div className="pt-3 border-t">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          OTHERS' SCHEDULES
                        </h4>
                        <div className="space-y-2">
                          {selectedDayOthersBusy.map(({ email, busyTime }) => (
                            <OtherUserBusyCard
                              key={`${email}-${busyTime.id}`}
                              email={email}
                              busyTime={busyTime}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a day to view meetings</p>
                </div>
              </div>
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

function MeetingCard({ meeting }: { meeting: MeetingWithDetails }) {
  const startTime = new Date(meeting.start_time)
  const endTime = new Date(meeting.end_time)
  const { user } = useUser()
  const { csrfToken } = useCSRF()

  // Find current user's attendee record
  const myAttendee = meeting.attendees?.find(
    (a) => a.user_id === user?.id || (user?.email && a.email?.toLowerCase() === user.email.toLowerCase())
  )

  const handleRsvp = async (status: AttendeeStatus) => {
    try {
      const res = await fetch("/api/meetings/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ meeting_id: meeting.id, status }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(`RSVP updated: ${status}`)
    } catch {
      toast.error("Failed to update RSVP")
    }
  }

  const isRecurring = meeting.recurrence_type && meeting.recurrence_type !== "none"

  return (
    <div className="p-3 bg-background border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-1.5">
        <h4 className="font-medium text-sm truncate flex-1">{meeting.title}</h4>
        {isRecurring && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            Recurring
          </Badge>
        )}
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
          </span>
        </div>

        {meeting.location && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{meeting.location}</span>
          </div>
        )}

        {meeting.attendees && meeting.attendees.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{meeting.attendees.length} attendees</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <Badge
          className={cn("text-[10px]", MEETING_STATUS_COLORS[meeting.status])}
          variant="secondary"
        >
          {meeting.status}
        </Badge>

        {meeting.video_room_url && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => window.open(meeting.video_room_url!, "_blank")}
          >
            <Video className="h-3 w-3 mr-1 text-blue-500" />
            Join
          </Button>
        )}
      </div>

      {/* RSVP buttons for non-organizer attendees */}
      {myAttendee && meeting.organizer_id !== user?.id && (
        <div className="mt-2 pt-2 border-t flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">RSVP:</span>
          {(["accepted", "tentative", "declined"] as AttendeeStatus[]).map((s) => (
            <Button
              key={s}
              variant={myAttendee.status === s ? "default" : "outline"}
              size="sm"
              className={cn("h-5 px-1.5 text-[10px]", myAttendee.status === s && ATTENDEE_STATUS_COLORS[s])}
              onClick={() => handleRsvp(s)}
            >
              {s === "accepted" ? "Accept" : s === "tentative" ? "Maybe" : "Decline"}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Other User Busy Card Component
// ----------------------------------------------------------------------------

function OtherUserBusyCard({ email, busyTime }: { email: string; busyTime: BusyTime }) {
  const startTime = new Date(busyTime.start_time)
  const endTime = new Date(busyTime.end_time)

  // Extract display name from email (part before @)
  const displayName = email.split("@")[0].replace(/[._]/g, " ")

  return (
    <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center text-xs font-medium text-red-700 dark:text-red-300">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate capitalize">{displayName}</p>
          <p className="text-[10px] text-muted-foreground truncate">{email}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
        <Clock className="h-3 w-3" />
        <span>
          {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 truncate" title={busyTime.title}>
        {busyTime.title}
      </p>
    </div>
  )
}

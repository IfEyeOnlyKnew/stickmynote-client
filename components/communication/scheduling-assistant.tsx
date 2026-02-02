"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Clock,
  Calendar,
  X,
  Check,
} from "lucide-react"
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  addMinutes,
} from "date-fns"
import { cn } from "@/lib/utils"
import { VideoInviteUserSearch } from "@/components/video/VideoInviteUserSearch"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface BusyTime {
  id: string
  title: string
  start_time: string
  end_time: string
  is_organizer: boolean
}

interface SchedulingAssistantProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule?: (selectedSlot: { date: Date; startTime: Date; endTime: Date; participants: string[] }) => void
  defaultDate?: Date
}

interface TimeSlot {
  time: Date
  label: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const SLOT_DURATION_MINUTES = 30
const DEFAULT_START_HOUR = 8  // 8 AM
const DEFAULT_END_HOUR = 17   // 5 PM

// Generate time slots for a day
function generateTimeSlots(date: Date, startHour: number, endHour: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  let current = setMinutes(setHours(date, startHour), 0)
  const end = setMinutes(setHours(date, endHour), 0)

  while (current < end) {
    slots.push({
      time: current,
      label: format(current, "h:mm a"),
    })
    current = addMinutes(current, SLOT_DURATION_MINUTES)
  }

  return slots
}

// Check if a time slot overlaps with a busy period
function isSlotBusy(slotStart: Date, slotEnd: Date, busyTimes: BusyTime[]): BusyTime | null {
  for (const busy of busyTimes) {
    const busyStart = new Date(busy.start_time)
    const busyEnd = new Date(busy.end_time)

    // Overlap check: slot starts before busy ends AND slot ends after busy starts
    if (slotStart < busyEnd && slotEnd > busyStart) {
      return busy
    }
  }
  return null
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SchedulingAssistant({
  open,
  onOpenChange,
  onSchedule,
  defaultDate,
}: SchedulingAssistantProps) {
  // Current week being viewed
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const baseDate = defaultDate || new Date()
    return startOfWeek(baseDate, { weekStartsOn: 1 }) // Monday start
  })

  // Selected time slot
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date
    startTime: Date
    endTime: Date
  } | null>(null)

  // Participants
  const [participantEmails, setParticipantEmails] = useState<string[]>([])
  const [participantBusyTimes, setParticipantBusyTimes] = useState<Record<string, BusyTime[]>>({})
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)

  // My busy times
  const [myBusyTimes, setMyBusyTimes] = useState<BusyTime[]>([])
  const [isLoadingMyBusy, setIsLoadingMyBusy] = useState(false)

  // Calculate week days (Mon-Fri)
  const weekDays = useMemo(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    const allDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd })
    // Only Mon-Fri (first 5 days)
    return allDays.slice(0, 5)
  }, [currentWeekStart])

  // Generate time slots for display
  const timeSlots = useMemo(() => {
    return generateTimeSlots(new Date(), DEFAULT_START_HOUR, DEFAULT_END_HOUR)
  }, [])

  // Fetch my busy times for the week
  useEffect(() => {
    if (!open) return

    const fetchMyBusyTimes = async () => {
      setIsLoadingMyBusy(true)
      try {
        const weekEnd = addMinutes(setHours(weekDays[weekDays.length - 1], DEFAULT_END_HOUR), 0)
        const params = new URLSearchParams({
          start: currentWeekStart.toISOString(),
          end: weekEnd.toISOString(),
        })

        const response = await fetch(`/api/meetings?${params}`)
        if (response.ok) {
          const data = await response.json()
          // Convert meetings to BusyTime format
          const busyTimes: BusyTime[] = (data.meetings || []).map((m: any) => ({
            id: m.id,
            title: m.title,
            start_time: m.start_time,
            end_time: m.end_time,
            is_organizer: true,
          }))
          setMyBusyTimes(busyTimes)
        }
      } catch (error) {
        console.error("[SchedulingAssistant] Error fetching my busy times:", error)
      } finally {
        setIsLoadingMyBusy(false)
      }
    }

    fetchMyBusyTimes()
  }, [open, currentWeekStart, weekDays])

  // Fetch participants' availability
  useEffect(() => {
    if (!open || participantEmails.length === 0) {
      setParticipantBusyTimes({})
      return
    }

    const fetchAvailability = async () => {
      setIsLoadingAvailability(true)
      try {
        const weekEnd = addMinutes(setHours(weekDays[weekDays.length - 1], DEFAULT_END_HOUR), 0)
        const params = new URLSearchParams({
          emails: participantEmails.join(","),
          start: currentWeekStart.toISOString(),
          end: weekEnd.toISOString(),
        })

        const response = await fetch(`/api/users/availability?${params}`)
        if (response.ok) {
          const data = await response.json()
          setParticipantBusyTimes(data.availability || {})
        }
      } catch (error) {
        console.error("[SchedulingAssistant] Error fetching availability:", error)
      } finally {
        setIsLoadingAvailability(false)
      }
    }

    fetchAvailability()
  }, [open, currentWeekStart, participantEmails, weekDays])

  // Navigation handlers
  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1))
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1))
  const handleThisWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Slot selection handler
  const handleSlotClick = (day: Date, slotTime: TimeSlot) => {
    const startTime = setMinutes(setHours(day, slotTime.time.getHours()), slotTime.time.getMinutes())
    const endTime = addMinutes(startTime, SLOT_DURATION_MINUTES)

    setSelectedSlot({
      date: day,
      startTime,
      endTime,
    })
  }

  // Schedule handler
  const handleSchedule = () => {
    if (selectedSlot && onSchedule) {
      onSchedule({
        ...selectedSlot,
        participants: participantEmails,
      })
      onOpenChange(false)
    }
  }

  // Get display name from email
  const getDisplayName = (email: string) => {
    return email.split("@")[0].replace(/[._]/g, " ")
  }

  // Check if a slot is selected
  const isSlotSelected = (day: Date, slotTime: TimeSlot) => {
    if (!selectedSlot) return false
    return (
      isSameDay(day, selectedSlot.date) &&
      slotTime.time.getHours() === selectedSlot.startTime.getHours() &&
      slotTime.time.getMinutes() === selectedSlot.startTime.getMinutes()
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Scheduling Assistant
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleThisWeek}>
                This Week
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {format(currentWeekStart, "MMMM d")} - {format(weekDays[weekDays.length - 1], "MMMM d, yyyy")}
          </p>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Participants Panel */}
          <div className="w-72 border-r flex flex-col bg-muted/30">
            <div className="p-4 border-b bg-background">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                Participants
              </Label>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">Search LDAP</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  LDAP
                </span>
              </div>
              <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-2">
                <VideoInviteUserSearch
                  selectedEmails={participantEmails}
                  onEmailsChange={setParticipantEmails}
                />
              </div>
              {isLoadingAvailability && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading availability...
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="p-4 border-b">
              <p className="text-xs font-medium text-muted-foreground mb-2">Legend</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-3 rounded bg-blue-500" />
                  <span>Your meetings</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-3 rounded bg-red-400" />
                  <span>Participant busy</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-3 rounded bg-green-500" />
                  <span>Selected slot</span>
                </div>
              </div>
            </div>

            {/* Selected Slot Info */}
            {selectedSlot && (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border-b">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                  Selected Time
                </p>
                <p className="text-sm font-semibold">
                  {format(selectedSlot.date, "EEE, MMM d")}
                </p>
                <p className="text-sm">
                  {format(selectedSlot.startTime, "h:mm a")} - {format(selectedSlot.endTime, "h:mm a")}
                </p>
              </div>
            )}

            {/* Participant List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {participantEmails.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Add participants to see their availability
                  </p>
                ) : (
                  participantEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-2 p-2 bg-background rounded-lg border"
                    >
                      <div className="w-6 h-6 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center text-xs font-medium text-red-700 dark:text-red-300">
                        {getDisplayName(email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate capitalize">
                          {getDisplayName(email)}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Schedule Grid */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-[600px]">
              {/* Day Headers */}
              <div className="sticky top-0 z-10 bg-background border-b">
                <div className="grid grid-cols-[80px_repeat(5,1fr)]">
                  <div className="p-2 border-r" /> {/* Time column header */}
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 text-center border-r",
                        isToday(day) && "bg-orange-50 dark:bg-orange-950/20"
                      )}
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {format(day, "EEE")}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          isToday(day) && "text-orange-600 dark:text-orange-400"
                        )}
                      >
                        {format(day, "d")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Slots Grid */}
              <div className="relative">
                {(isLoadingMyBusy || isLoadingAvailability) && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {timeSlots.map((slot, slotIndex) => (
                  <div key={slot.label} className="grid grid-cols-[80px_repeat(5,1fr)]">
                    {/* Time Label */}
                    <div className="p-2 border-r border-b text-xs text-muted-foreground text-right pr-3">
                      {slot.label}
                    </div>

                    {/* Day Cells */}
                    {weekDays.map((day) => {
                      const slotStart = setMinutes(
                        setHours(day, slot.time.getHours()),
                        slot.time.getMinutes()
                      )
                      const slotEnd = addMinutes(slotStart, SLOT_DURATION_MINUTES)

                      // Check my busy times
                      const myBusy = isSlotBusy(slotStart, slotEnd, myBusyTimes)

                      // Check participants' busy times
                      const participantConflicts: { email: string; busy: BusyTime }[] = []
                      for (const email of participantEmails) {
                        const busyTimes = participantBusyTimes[email] || []
                        const busy = isSlotBusy(slotStart, slotEnd, busyTimes)
                        if (busy) {
                          participantConflicts.push({ email, busy })
                        }
                      }

                      const isSelected = isSlotSelected(day, slot)
                      const hasConflict = myBusy || participantConflicts.length > 0

                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => handleSlotClick(day, slot)}
                          className={cn(
                            "relative p-1 border-r border-b min-h-[40px] transition-colors",
                            "hover:bg-muted/50",
                            isSelected && "bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 ring-inset",
                            isToday(day) && !isSelected && "bg-orange-50/50 dark:bg-orange-950/10"
                          )}
                          title={
                            myBusy
                              ? `You: ${myBusy.title}`
                              : participantConflicts.length > 0
                              ? `Conflicts: ${participantConflicts.map((c) => getDisplayName(c.email)).join(", ")}`
                              : "Available"
                          }
                        >
                          {/* My busy indicator */}
                          {myBusy && (
                            <div
                              className="absolute inset-x-1 top-1 bottom-1 bg-blue-500/80 rounded text-[9px] text-white px-1 truncate"
                              title={myBusy.title}
                            >
                              {myBusy.title}
                            </div>
                          )}

                          {/* Participant conflicts */}
                          {!myBusy && participantConflicts.length > 0 && (
                            <div className="absolute inset-x-1 top-1 bottom-1 bg-red-400/60 rounded flex items-center justify-center">
                              <span className="text-[9px] text-white font-medium">
                                {participantConflicts.length} busy
                              </span>
                            </div>
                          )}

                          {/* Selected checkmark */}
                          {isSelected && !myBusy && participantConflicts.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedSlot}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Clock className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

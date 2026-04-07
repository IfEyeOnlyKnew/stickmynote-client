"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar, Loader2, Video, MapPin, Users, Clock, Repeat } from "lucide-react"
import { toast } from "sonner"
import { format, addMinutes, setHours, setMinutes, startOfDay, addMonths } from "date-fns"
import { useCommunicationPaletteContext } from "./communication-palette-provider"
import {
  MEETING_DURATION_PRESETS,
  DEFAULT_MEETING_DURATION,
  RECURRENCE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
  type RecurrenceType,
  type RecurrenceConfig,
} from "@/types/meeting"
import { VideoInviteUserSearch } from "@/components/video/VideoInviteUserSearch"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ScheduleMeetingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (meeting: any) => void
  defaultDate?: Date
  defaultParticipants?: string[]
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function buildRecurrenceConfig(
  recurrenceType: string, recurrenceInterval: number, recurrenceDays: number[],
  recurrenceDayOfMonth: number, recurrenceEndType: string, recurrenceEndDate: string, recurrenceCount: number,
): RecurrenceConfig | undefined {
  if (recurrenceType === "none") return undefined
  const recurrence: RecurrenceConfig = {
    type: recurrenceType as RecurrenceType,
    interval: recurrenceInterval,
  }
  if (recurrenceType === "weekly" && recurrenceDays.length > 0) {
    recurrence.days_of_week = recurrenceDays
  }
  if (recurrenceType === "monthly") {
    recurrence.day_of_month = recurrenceDayOfMonth
  }
  if (recurrenceEndType === "date") {
    recurrence.end_date = new Date(recurrenceEndDate).toISOString()
  } else if (recurrenceEndType === "count") {
    recurrence.count = recurrenceCount
  }
  return recurrence
}

function generateTimeSlots() {
  const slots: { value: string; label: string }[] = []
  const baseDate = startOfDay(new Date())

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = setMinutes(setHours(baseDate, hour), minute)
      slots.push({
        value: format(time, "HH:mm"),
        label: format(time, "h:mm a"),
      })
    }
  }

  return slots
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ScheduleMeetingModal({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  defaultParticipants,
}: Readonly<ScheduleMeetingModalProps>) {
  const { context } = useCommunicationPaletteContext()

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(format(defaultDate || new Date(), "yyyy-MM-dd"))

  // Update date when defaultDate changes
  useEffect(() => {
    if (defaultDate) {
      setDate(format(defaultDate, "yyyy-MM-dd"))
      // Also set start time if it's a specific time
      if (defaultDate.getHours() !== 0 || defaultDate.getMinutes() !== 0) {
        setStartTime(format(defaultDate, "HH:mm"))
      }
    }
  }, [defaultDate])

  // Update participants when defaultParticipants changes
  useEffect(() => {
    if (defaultParticipants && defaultParticipants.length > 0) {
      setSelectedEmails(defaultParticipants)
    }
  }, [defaultParticipants])
  const [startTime, setStartTime] = useState("09:00")
  const [duration, setDuration] = useState(DEFAULT_MEETING_DURATION.toString())
  const [location, setLocation] = useState("")
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [createVideoRoom, setCreateVideoRoom] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none")
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1)
  const [recurrenceEndType, setRecurrenceEndType] = useState<"never" | "date" | "count">("never")
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(format(addMonths(new Date(), 3), "yyyy-MM-dd"))
  const [recurrenceCount, setRecurrenceCount] = useState(10)

  // Generate time slots
  const timeSlots = useMemo(() => generateTimeSlots(), [])

  // Calculate end time from start time and duration
  const endTime = useMemo(() => {
    const [hours, minutes] = startTime.split(":").map(Number)
    const startDate = setMinutes(setHours(new Date(), hours), minutes)
    const endDate = addMinutes(startDate, Number.parseInt(duration, 10))
    return format(endDate, "HH:mm")
  }, [startTime, duration])

  // Get default title from context
  const getDefaultTitle = () => {
    if (context.padName) {
      return `${context.padName} Meeting`
    }
    if (context.stickTopic) {
      return `Discussion: ${context.stickTopic}`
    }
    return ""
  }

  const toggleRecurrenceDay = (dayValue: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue].sort((a, b) => a - b)
    )
  }

  const handleSubmit = async () => {
    console.log("[ScheduleMeeting] handleSubmit called")

    // Validate required fields
    const meetingTitle = title.trim() || getDefaultTitle()
    const errors: string[] = []

    if (!meetingTitle) {
      errors.push("Meeting title is required")
    }
    if (!date) {
      errors.push("Date is required")
    }
    if (!startTime) {
      errors.push("Start time is required")
    }

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error))
      return
    }

    setIsSubmitting(true)
    console.log("[ScheduleMeeting] Submitting meeting...")

    try {
      // Build start and end times
      const startDateTime = new Date(`${date}T${startTime}:00`)
      const endDateTime = new Date(`${date}T${endTime}:00`)

      // If end time is before start (e.g., crosses midnight), add a day
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1)
      }

      // Build recurrence config
      const recurrence = buildRecurrenceConfig(
        recurrenceType, recurrenceInterval, recurrenceDays,
        recurrenceDayOfMonth, recurrenceEndType, recurrenceEndDate, recurrenceCount,
      )

      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingTitle,
          description: description.trim() || undefined,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          location: location.trim() || undefined,
          attendee_emails: selectedEmails,
          create_video_room: createVideoRoom,
          pad_id: context.padId || undefined,
          stick_id: context.stickId || undefined,
          recurrence,
        }),
      })

      console.log("[ScheduleMeeting] Response status:", response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error("[ScheduleMeeting] Error response:", error)
        throw new Error(error.error || "Failed to schedule meeting")
      }

      const { meeting } = await response.json()
      console.log("[ScheduleMeeting] Meeting created:", meeting)

      toast.success("Meeting scheduled successfully")

      if (selectedEmails.length > 0) {
        toast.success(`Invitations sent to ${selectedEmails.length} participant(s)`)
      }

      // Reset form
      setTitle("")
      setDescription("")
      setLocation("")
      setSelectedEmails([])

      // Close modal
      onOpenChange(false)

      // Callback
      if (onSuccess) {
        onSuccess(meeting)
      }
    } catch (error) {
      console.error("[ScheduleMeeting] Error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to schedule meeting")
    } finally {
      console.log("[ScheduleMeeting] Complete")
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>
            Schedule a meeting for a specific date and time. Attendees will receive an email invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              placeholder={getDefaultTitle() || "Enter meeting title"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Context indicator */}
          {(context.padName || context.stickTopic) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              <Users className="h-4 w-4" />
              <span>
                Linked to: {context.padName || context.stickTopic}
              </span>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time *</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_DURATION_PRESETS.map((preset) => (
                  <SelectItem key={preset.minutes} value={preset.minutes.toString()}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ends at {timeSlots.find((s) => s.value === endTime)?.label || endTime}
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location (optional)
            </Label>
            <Input
              id="location"
              placeholder="Conference room, address, or leave blank for video only"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add meeting agenda or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Invite Users via LDAP Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Invite Participants</Label>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                LDAP
              </span>
            </div>
            <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-3">
              <VideoInviteUserSearch
                selectedEmails={selectedEmails}
                onEmailsChange={setSelectedEmails}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Repeat
              </Label>
              <Select
                value={recurrenceType}
                onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {recurrenceType !== "none" && (
              <div className="space-y-3 pl-2 border-l-2 border-purple-200 ml-2">
                {/* Interval */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Every</Label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                    className="w-16 h-8"
                  />
                  <span className="text-sm text-muted-foreground">
                    {recurrenceType === "daily" && (recurrenceInterval === 1 ? "day" : "days")}
                    {recurrenceType === "weekly" && (recurrenceInterval === 1 ? "week" : "weeks")}
                    {recurrenceType === "monthly" && (recurrenceInterval === 1 ? "month" : "months")}
                    {recurrenceType === "yearly" && (recurrenceInterval === 1 ? "year" : "years")}
                  </span>
                </div>

                {/* Weekly: day picker */}
                {recurrenceType === "weekly" && (
                  <div className="space-y-1">
                    <Label className="text-sm">On days</Label>
                    <div className="flex gap-1">
                      {DAY_OF_WEEK_LABELS.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleRecurrenceDay(day.value)}
                          className={`w-9 h-8 rounded text-xs font-medium transition-colors ${
                            recurrenceDays.includes(day.value)
                              ? "bg-purple-600 text-white"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly: day of month */}
                {recurrenceType === "monthly" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">On day</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={recurrenceDayOfMonth}
                      onChange={(e) => setRecurrenceDayOfMonth(Math.min(31, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
                      className="w-16 h-8"
                    />
                    <span className="text-sm text-muted-foreground">of the month</span>
                  </div>
                )}

                {/* End condition */}
                <div className="space-y-2">
                  <Label className="text-sm">Ends</Label>
                  <Select value={recurrenceEndType} onValueChange={(v) => setRecurrenceEndType(v as "never" | "date" | "count")}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="date">On date</SelectItem>
                      <SelectItem value="count">After occurrences</SelectItem>
                    </SelectContent>
                  </Select>

                  {recurrenceEndType === "date" && (
                    <Input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      min={date}
                      className="h-8"
                    />
                  )}

                  {recurrenceEndType === "count" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={2}
                        max={365}
                        value={recurrenceCount}
                        onChange={(e) => setRecurrenceCount(Math.max(2, Number.parseInt(e.target.value, 10) || 2))}
                        className="w-20 h-8"
                      />
                      <span className="text-sm text-muted-foreground">occurrences</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Create Video Room */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-blue-500" />
              <div>
                <Label htmlFor="video-room" className="text-sm font-medium">
                  Create Video Room
                </Label>
                <p className="text-xs text-muted-foreground">
                  Include a video call link in the invitation
                </p>
              </div>
            </div>
            <Switch
              id="video-room"
              checked={createVideoRoom}
              onCheckedChange={setCreateVideoRoom}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t flex-shrink-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

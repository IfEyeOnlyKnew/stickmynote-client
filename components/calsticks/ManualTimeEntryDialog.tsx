"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, DollarSign, Save } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { format } from "date-fns"
import type { CalStick } from "@/types/calstick"

interface ManualTimeEntryDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function ManualTimeEntryDialog({ isOpen, onClose, onSaved }: ManualTimeEntryDialogProps) {
  const [tasks, setTasks] = useState<CalStick[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")
  const [date, setDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [note, setNote] = useState("")
  const [isBillable, setIsBillable] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchTasks()
    }
  }, [isOpen])

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/calsticks")
      if (response.ok) {
        const data = await response.json()
        setTasks(data.calsticks || [])
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
    }
  }

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0
    const [startHour, startMin] = start.split(":").map(Number)
    const [endHour, endMin] = end.split(":").map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    return Math.max(0, (endMinutes - startMinutes) * 60) // Convert to seconds
  }

  const handleSave = async () => {
    if (!selectedTaskId || !date || !startTime || !endTime) {
      alert("Please fill in all required fields")
      return
    }

    const duration = calculateDuration(startTime, endTime)
    if (duration <= 0) {
      alert("End time must be after start time")
      return
    }

    setIsSaving(true)
    try {
      const startedAt = new Date(date)
      const [startHour, startMin] = startTime.split(":").map(Number)
      startedAt.setHours(startHour, startMin, 0, 0)

      const endedAt = new Date(date)
      const [endHour, endMin] = endTime.split(":").map(Number)
      endedAt.setHours(endHour, endMin, 0, 0)

      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTaskId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds: duration,
          note,
          isBillable,
        }),
      })

      if (!response.ok) throw new Error("Failed to save time entry")

      onSaved()
      // Reset form
      setSelectedTaskId("")
      setDate(new Date())
      setStartTime("")
      setEndTime("")
      setNote("")
      setIsBillable(true)
    } catch (error) {
      console.error("Error saving time entry:", error)
      alert("Failed to save time entry")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task">Task *</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger id="task">
                <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.content || "Untitled Task"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {startTime && endTime && (
            <div className="text-sm text-muted-foreground">
              Duration: {Math.floor(calculateDuration(startTime, endTime) / 3600)}h{" "}
              {Math.floor((calculateDuration(startTime, endTime) % 3600) / 60)}m
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="billable">Billable</Label>
            </div>
            <Switch id="billable" checked={isBillable} onCheckedChange={setIsBillable} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add details about what you worked on..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

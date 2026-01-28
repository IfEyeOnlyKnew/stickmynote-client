"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Repeat, CalendarIcon } from "lucide-react" // Added CalendarIcon
import { toast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover" // Added Popover imports
import { Calendar } from "@/components/ui/calendar" // Added Calendar import
import { format } from "date-fns" // Added format import
import { cn } from "@/lib/utils" // Added cn import

interface RecurringTaskModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly taskId: string
}

// Helper to get interval label based on frequency
function getIntervalLabel(frequency: "daily" | "weekly" | "monthly"): string {
  if (frequency === "daily") return "Days"
  if (frequency === "weekly") return "Weeks"
  return "Months"
}

export function RecurringTaskModal({ isOpen, onClose, taskId }: RecurringTaskModalProps) {
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [interval, setInterval] = useState(1)
  const [endDate, setEndDate] = useState<Date>()
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const handleSave = async () => {
    setLoading(true) // Added loading state
    try {
      const payload: any = {
        taskId,
        frequency,
        interval: Number(interval),
        end_date: endDate?.toISOString(),
      }

      if (frequency === "weekly" && selectedDays.length > 0) {
        payload.days_of_week = selectedDays
      }

      const res = await fetch("/api/automation/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to set recurrence")

      toast({ title: "Success", description: "Task will repeat " + frequency })
      onClose()
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" })
    } finally {
      setLoading(false) // Reset loading state
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        {" "}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-blue-500" />
            Repeat Task
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Every X {getIntervalLabel(frequency)}</Label>
              <Input type="number" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
            </div>
          </div>

          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Repeat On</Label>
              <div className="flex gap-2">
                {dayNames.map((day, idx) => (
                  <Button
                    key={day}
                    variant={selectedDays.includes(idx) ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleDay(idx)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "No end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} autoFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Recurrence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

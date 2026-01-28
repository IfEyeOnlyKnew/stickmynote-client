"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Bell } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ReminderModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly taskId: string
}

export function ReminderModal({ isOpen, onClose, taskId }: ReminderModalProps) {
  const [reminderDate, setReminderDate] = useState<Date>()
  const [reminderTime, setReminderTime] = useState("09:00")
  const [reminderType, setReminderType] = useState<"notification" | "email">("notification")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreateReminder = async () => {
    if (!reminderDate) {
      toast({ title: "Error", description: "Please select a date and time", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const [hours, minutes] = reminderTime.split(":")
      const remindAt = new Date(reminderDate)
      remindAt.setHours(Number.parseInt(hours), Number.parseInt(minutes), 0, 0)

      const payload = {
        taskId,
        remind_at: remindAt.toISOString(),
        reminder_type: reminderType,
        message: message || undefined,
      }

      const res = await fetch("/api/automation/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to create reminder")

      toast({
        title: "Reminder Set",
        description: `You'll be reminded on ${format(remindAt, "PPP 'at' p")}`,
      })
      onClose()
    } catch {
      toast({
        title: "Error",
        description: "Could not create reminder",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" />
            Set Reminder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reminder Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !reminderDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reminderDate ? format(reminderDate, "PP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate} autoFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reminder Type</Label>
            <Select value={reminderType} onValueChange={(v: any) => setReminderType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notification">In-App Notification</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Custom Message (Optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a custom reminder message..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCreateReminder} disabled={loading}>
              {loading ? "Setting..." : "Set Reminder"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

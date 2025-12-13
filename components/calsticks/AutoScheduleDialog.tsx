"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar, Loader2, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { CalStick } from "@/types/calstick"

interface AutoScheduleDialogProps {
  isOpen: boolean
  onClose: () => void
  unscheduledTasks: CalStick[]
  onTasksScheduled: (updates: { id: string; startDate: string; endDate: string }[]) => Promise<void>
}

export function AutoScheduleDialog({ isOpen, onClose, unscheduledTasks, onTasksScheduled }: AutoScheduleDialogProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleAutoSchedule = async () => {
    if (unscheduledTasks.length === 0) {
      toast({
        title: "No tasks to schedule",
        description: "All tasks already have dates assigned.",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/calsticks/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: unscheduledTasks.map((t) => ({
            id: t.id,
            title: t.content,
            priority: t.calstick_priority,
            estimatedHours: t.calstick_estimated_hours || 1,
          })),
        }),
      })

      if (!response.ok) throw new Error("Failed to auto-schedule")

      const { schedule } = await response.json()

      if (schedule && schedule.length > 0) {
        await onTasksScheduled(schedule)
        onClose()
        toast({
          title: "Success",
          description: `Auto-scheduled ${schedule.length} task${schedule.length > 1 ? "s" : ""}`,
        })
      }
    } catch (error) {
      console.error("Error auto-scheduling:", error)
      toast({
        title: "Error",
        description: "Failed to auto-schedule tasks. Please try again.",
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
            <Zap className="h-5 w-5" />
            Auto-Schedule Tasks
          </DialogTitle>
          <DialogDescription>
            AI will find optimal time slots for your unscheduled tasks based on priority and estimated hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tasks to schedule</span>
              <span className="text-2xl font-bold">{unscheduledTasks.length}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Total estimated hours: {unscheduledTasks.reduce((sum, t) => sum + (t.calstick_estimated_hours || 1), 0)}h
            </div>
          </div>

          {unscheduledTasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Preview:</div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {unscheduledTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="text-sm p-2 rounded bg-muted">
                    {task.content} ({task.calstick_estimated_hours || 1}h)
                  </div>
                ))}
                {unscheduledTasks.length > 5 && (
                  <div className="text-sm text-muted-foreground">+{unscheduledTasks.length - 5} more tasks</div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleAutoSchedule} disabled={unscheduledTasks.length === 0 || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Auto-Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

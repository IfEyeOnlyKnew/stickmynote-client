"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import GanttChart from "@/components/calsticks/GanttChart"
import type { CalStick } from "@/types/calstick"

interface StickGanttModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  stickTopic?: string
}

export function StickGanttModal({ open, onOpenChange, stickId, stickTopic }: Readonly<StickGanttModalProps>) {
  const [calsticks, setCalsticks] = useState<CalStick[]>([])
  const [loading, setLoading] = useState(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && stickId) {
      fetchCalSticks()
    }
  }, [open, stickId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchCalSticks = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sticks/${stickId}/calsticks`)
      if (!response.ok) throw new Error("Failed to fetch CalSticks")
      const data = await response.json()
      setCalsticks(data.calsticks || [])
    } catch (error) {
      console.error("Error fetching CalSticks:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Gantt Chart - {stickTopic || "Stick Tasks"}</DialogTitle>
          <DialogDescription>View and manage CalSticks in a Gantt chart timeline</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <GanttChart calsticks={calsticks} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

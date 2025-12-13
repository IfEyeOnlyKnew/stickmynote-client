"use client"

import { useState, useEffect, useRef } from "react"
import { Play, Square, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { formatDuration } from "@/lib/utils"

interface TaskTimerProps {
  taskId: string
  initialDuration?: number
  onTimerStop?: (duration: number) => void
}

export function TaskTimer({ taskId, initialDuration = 0, onTimerStop }: TaskTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(initialDuration)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [tableExists, setTableExists] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check for active timer on mount
  useEffect(() => {
    const checkActiveTimer = async () => {
      try {
        const response = await fetch(`/api/time-entries/active?taskId=${taskId}`)
        if (response.ok) {
          const data = await response.json()

          if (data.tableExists === false) {
            setTableExists(false)
            return
          }

          if (data.activeEntry) {
            setEntryId(data.activeEntry.id)
            setIsRunning(true)
            const startTime = new Date(data.activeEntry.started_at).getTime()
            const now = new Date().getTime()
            setElapsed(Math.floor((now - startTime) / 1000))
          }
        }
      } catch (error) {
        console.error("Failed to check active timer:", error)
        setTableExists(false)
      }
    }

    checkActiveTimer()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [taskId])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning])

  const toggleTimer = async () => {
    if (!tableExists) {
      toast({
        title: "Time Tracking Not Available",
        description: "Please run the Phase 2 database migration script.",
        variant: "destructive",
      })
      return
    }

    try {
      if (isRunning) {
        // Stop timer
        if (!entryId) return

        const response = await fetch(`/api/time-entries/${entryId}/stop`, {
          method: "POST",
        })

        if (!response.ok) throw new Error("Failed to stop timer")

        setIsRunning(false)
        setEntryId(null)
        if (onTimerStop) onTimerStop(elapsed)

        toast({
          title: "Timer Stopped",
          description: `Logged ${formatDuration(elapsed)}`,
        })
      } else {
        // Start timer
        const response = await fetch("/api/time-entries/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        })

        if (!response.ok) throw new Error("Failed to start timer")

        const data = await response.json()
        setEntryId(data.id)
        setIsRunning(true)

        toast({
          title: "Timer Started",
          description: "Tracking time for this task",
        })
      }
    } catch (error) {
      console.error("Timer error:", error)
      toast({
        title: "Error",
        description: "Failed to update timer",
        variant: "destructive",
      })
    }
  }

  if (!tableExists) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs">Time tracking unavailable</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`font-mono text-sm ${isRunning ? "text-green-600 font-bold" : "text-muted-foreground"}`}>
        {formatDuration(elapsed)}
      </div>
      <Button
        size="sm"
        variant={isRunning ? "destructive" : "outline"}
        className={isRunning ? "animate-pulse" : ""}
        onClick={toggleTimer}
      >
        {isRunning ? <Square className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
        {isRunning ? "Stop" : "Start"}
      </Button>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Archive, RotateCcw, Loader2, Calendar, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import type { CalStick } from "@/types/calstick"

interface ArchivedTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnarchive: (taskId: string) => Promise<void>
}

export function ArchivedTasksDialog({ open, onOpenChange, onUnarchive }: ArchivedTasksDialogProps) {
  const [archivedTasks, setArchivedTasks] = useState<CalStick[]>([])
  const [loading, setLoading] = useState(false)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchArchivedTasks()
    }
  }, [open, page])

  const fetchArchivedTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/calsticks/archive?page=${page}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        if (page === 1) {
          setArchivedTasks(data.archivedTasks)
        } else {
          setArchivedTasks((prev) => [...prev, ...data.archivedTasks])
        }
        setHasMore(data.hasMore)
        setTotal(data.total)
      }
    } catch (error) {
      console.error("Failed to fetch archived tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUnarchive = async (taskId: string) => {
    try {
      setUnarchiving(taskId)
      await onUnarchive(taskId)
      setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId))
      setTotal((prev) => prev - 1)
      toast({
        title: "Task restored",
        description: "The task has been moved back to the Done column",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore task",
        variant: "destructive",
      })
    } finally {
      setUnarchiving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archived Tasks
          </DialogTitle>
          <DialogDescription>
            {total} archived task{total !== 1 ? "s" : ""}. Restore tasks to move them back to the board.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading && page === 1 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : archivedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Archive className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No archived tasks</p>
              <p className="text-xs text-muted-foreground mt-1">
                Completed tasks will appear here when archived
              </p>
            </div>
          ) : (
            <>
              {archivedTasks.map((task) => (
                <Card key={task.id} className="border-l-4 border-l-gray-300">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <h4 className="text-sm font-medium truncate">
                            {task.stick?.topic || "Untitled"}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {task.content}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnarchive(task.id)}
                        disabled={unarchiving === task.id}
                        className="flex-shrink-0"
                      >
                        {unarchiving === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        <span className="ml-1">Restore</span>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3 px-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {task.stick?.pad?.name || "No pad"}
                      </Badge>
                      {task.calstick_completed_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed {format(parseISO(task.calstick_completed_at), "MMM d, yyyy")}
                        </span>
                      )}
                      {task.archived_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Archived {format(parseISO(task.archived_at), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

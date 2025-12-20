"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Plus, Calendar, User, Sparkles, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import type { CalStick } from "@/types/calstick"
import { toast } from "@/hooks/use-toast"

// Helper function to get priority badge color
function getPriorityBadgeColor(priority: string): string {
  if (priority === "urgent") return "bg-red-100 text-red-700"
  if (priority === "high") return "bg-orange-100 text-orange-700"
  return ""
}

interface SubtaskPanelProps {
  parentCalstick: CalStick
  onSubtaskClick: (subtask: CalStick) => void
  onRefresh: () => void
}

export function SubtaskPanel({ parentCalstick, onSubtaskClick, onRefresh }: SubtaskPanelProps) {
  const [subtasks, setSubtasks] = useState<CalStick[]>([])
  const [loading, setLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newSubtaskContent, setNewSubtaskContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    fetchSubtasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentCalstick.id])

  const fetchSubtasks = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/calsticks/${parentCalstick.id}/subtasks`)
      if (!response.ok) throw new Error("Failed to fetch subtasks")
      const data = await response.json()
      setSubtasks(data.subtasks || [])
    } catch (error) {
      console.error("Error fetching subtasks:", error)
      toast({
        title: "Error",
        description: "Failed to load subtasks",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddSubtask = async () => {
    if (!newSubtaskContent.trim()) return

    try {
      const response = await fetch(`/api/sticks/${parentCalstick.stick_id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newSubtaskContent.trim(),
          is_calstick: true,
          calstick_parent_id: parentCalstick.id,
          calstick_status: "todo",
          calstick_priority: "medium",
          color: parentCalstick.color,
        }),
      })

      if (!response.ok) throw new Error("Failed to create subtask")

      setNewSubtaskContent("")
      setIsAdding(false)
      await fetchSubtasks()
      onRefresh()

      toast({
        title: "Success",
        description: "Subtask created successfully",
      })
    } catch (error) {
      console.error("Error creating subtask:", error)
      toast({
        title: "Error",
        description: "Failed to create subtask",
        variant: "destructive",
      })
    }
  }

  const handleGenerateSubtasks = async () => {
    try {
      setIsGenerating(true)
      const response = await fetch("/api/ai/generate-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskContent: parentCalstick.content,
          parentId: parentCalstick.id,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate subtasks")

      const data = await response.json()
      const generatedSubtasks: string[] = data.subtasks

      await Promise.all(
        generatedSubtasks.map(async (content) => {
          await fetch(`/api/sticks/${parentCalstick.stick_id}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: content,
              is_calstick: true,
              calstick_parent_id: parentCalstick.id,
              calstick_status: "todo",
              calstick_priority: "medium",
              color: parentCalstick.color,
            }),
          })
        }),
      )

      await fetchSubtasks()
      onRefresh()
      toast({
        title: "AI Generated",
        description: `Added ${generatedSubtasks.length} subtasks suggested by AI.`,
      })
    } catch (error) {
      console.error("Error generating subtasks:", error)
      toast({
        title: "Error",
        description: "Failed to generate subtasks",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleToggleComplete = async (subtask: CalStick) => {
    try {
      const response = await fetch(`/api/sticks/replies/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calstick_completed: !subtask.calstick_completed,
          calstick_completed_at: !subtask.calstick_completed ? new Date().toISOString() : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to update subtask")

      await fetchSubtasks()
      onRefresh()
    } catch (error) {
      console.error("Error updating subtask:", error)
      toast({
        title: "Error",
        description: "Failed to update subtask",
        variant: "destructive",
      })
    }
  }

  const completedCount = subtasks.filter((st) => st.calstick_completed).length
  const totalCount = subtasks.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Subtasks {totalCount > 0 && `(${completedCount}/${totalCount})`}</h3>
          {totalCount > 0 && <span className="text-xs text-muted-foreground">{Math.round(progress)}% complete</span>}
        </div>
        {totalCount > 0 && <Progress value={progress} className="h-2" />}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading subtasks...</p>
      ) : (
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              role="button"
              tabIndex={0}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onSubtaskClick(subtask)}
              onKeyDown={(e) => e.key === "Enter" && onSubtaskClick(subtask)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleComplete(subtask)
                }}
                className="hover:scale-110 transition-transform mt-0.5"
              >
                {subtask.calstick_completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${subtask.calstick_completed ? "line-through text-muted-foreground" : ""}`}>
                  {subtask.content}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {subtask.calstick_status && (
                    <Badge variant="outline" className="text-xs">
                      {subtask.calstick_status}
                    </Badge>
                  )}
                  {subtask.calstick_priority && (
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getPriorityBadgeColor(subtask.calstick_priority)}`}
                    >
                      {subtask.calstick_priority}
                    </Badge>
                  )}
                  {subtask.calstick_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(subtask.calstick_date), "MMM d")}
                    </span>
                  )}
                  {subtask.calstick_assignee_id && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Assigned
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            value={newSubtaskContent}
            onChange={(e) => setNewSubtaskContent(e.target.value)}
            placeholder="Subtask description..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask()
              if (e.key === "Escape") {
                setIsAdding(false)
                setNewSubtaskContent("")
              }
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="text-sm"
          />
          <Button size="sm" onClick={handleAddSubtask}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsAdding(false)
              setNewSubtaskContent("")
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="flex-1 justify-start">
            <Plus className="h-4 w-4 mr-2" />
            Add subtask
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateSubtasks}
            disabled={isGenerating}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            title="Auto-generate subtasks with AI"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                AI Break Down
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

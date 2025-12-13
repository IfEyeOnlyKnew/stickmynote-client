"use client"

import { Progress } from "@/components/ui/progress"
import { CheckSquare, ListTodo } from "lucide-react"
import type { TaskProgress } from "@/types/checklist"

interface TaskProgressIndicatorProps {
  progress: TaskProgress
  compact?: boolean
}

export function TaskProgressIndicator({ progress, compact = false }: TaskProgressIndicatorProps) {
  const hasChecklist = progress.checklist.total > 0
  const hasSubtasks = progress.subtasks.total > 0

  if (!hasChecklist && !hasSubtasks) {
    return null
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Progress value={progress.overall} className="h-1.5 w-20" />
        <span className="text-xs text-muted-foreground">{progress.overall}%</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Progress</span>
        <span className="text-sm text-muted-foreground">{progress.overall}%</span>
      </div>
      <Progress value={progress.overall} className="h-2" />

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {hasChecklist && (
          <div className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            <span>
              {progress.checklist.completed}/{progress.checklist.total} checklist
            </span>
          </div>
        )}
        {hasSubtasks && (
          <div className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" />
            <span>
              {progress.subtasks.completed}/{progress.subtasks.total} subtasks
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

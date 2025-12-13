"use client"

import type React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WORKFLOW_STATUSES, WORKFLOW_ORDER, type WorkflowStatus } from "@/types/social-workflow"
import { Lightbulb, Filter, Play, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowStatusSelectProps {
  value: WorkflowStatus
  onChange: (status: WorkflowStatus) => void
  disabled?: boolean
  className?: string
}

const statusIcons: Record<WorkflowStatus, React.ReactNode> = {
  idea: <Lightbulb className="h-4 w-4" />,
  triage: <Filter className="h-4 w-4" />,
  in_progress: <Play className="h-4 w-4" />,
  resolved: <CheckCircle2 className="h-4 w-4" />,
}

export function WorkflowStatusSelect({ value, onChange, disabled, className }: WorkflowStatusSelectProps) {
  const currentConfig = WORKFLOW_STATUSES[value]

  return (
    <Select value={value} onValueChange={(v) => onChange(v as WorkflowStatus)} disabled={disabled}>
      <SelectTrigger className={cn("w-[160px]", className)}>
        <SelectValue>
          <div className={cn("flex items-center gap-2", currentConfig.color)}>
            {statusIcons[value]}
            <span>{currentConfig.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {WORKFLOW_ORDER.map((status) => {
          const config = WORKFLOW_STATUSES[status]
          return (
            <SelectItem key={status} value={status}>
              <div className={cn("flex items-center gap-2", config.color)}>
                {statusIcons[status]}
                <span>{config.label}</span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

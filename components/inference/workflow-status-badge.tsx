"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { WORKFLOW_STATUSES, type WorkflowStatus } from "@/types/inference-workflow"
import { Lightbulb, Filter, Play, CheckCircle2 } from "lucide-react"

interface WorkflowStatusBadgeProps {
  status: WorkflowStatus
  size?: "sm" | "default"
  showIcon?: boolean
  className?: string
}

const statusIcons: Record<WorkflowStatus, React.ReactNode> = {
  idea: <Lightbulb className="h-3 w-3" />,
  triage: <Filter className="h-3 w-3" />,
  in_progress: <Play className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
}

export function WorkflowStatusBadge({
  status,
  size = "default",
  showIcon = true,
  className,
}: WorkflowStatusBadgeProps) {
  const config = WORKFLOW_STATUSES[status]

  return (
    <Badge
      variant="outline"
      className={cn(
        config.bgColor,
        config.borderColor,
        config.color,
        size === "sm" ? "text-xs px-1.5 py-0" : "px-2 py-0.5",
        "font-medium flex items-center gap-1",
        className,
      )}
    >
      {showIcon && statusIcons[status]}
      {config.label}
    </Badge>
  )
}

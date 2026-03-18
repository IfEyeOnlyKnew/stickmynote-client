"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Trash2, Move, Copy, Archive, Share2, X, UserPlus, Lightbulb, Filter, Play, CheckCircle2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WorkflowStatus } from "@/types/inference-workflow"
import { WORKFLOW_STATUSES, WORKFLOW_ORDER } from "@/types/inference-workflow"

type BulkActionsToolbarProps = {
  selectedCount: number
  onClear: () => void
  onDelete: () => void
  onMove?: () => void
  onCopy?: () => void
  onArchive?: () => void
  onShare?: () => void
  onChangeStatus?: (status: WorkflowStatus) => void
  onAssignOwner?: () => void
}

const statusIcons: Record<WorkflowStatus, React.ReactNode> = {
  idea: <Lightbulb className="h-4 w-4" />,
  triage: <Filter className="h-4 w-4" />,
  in_progress: <Play className="h-4 w-4" />,
  resolved: <CheckCircle2 className="h-4 w-4" />,
}

export function BulkActionsToolbar({
  selectedCount,
  onClear,
  onDelete,
  onMove,
  onCopy,
  onArchive,
  onShare,
  onChangeStatus,
  onAssignOwner,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-background border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </div>

        <div className="h-4 w-px bg-border" />

        {onChangeStatus && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Lightbulb className="h-4 w-4 mr-2" />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {WORKFLOW_ORDER.map((status) => {
                const config = WORKFLOW_STATUSES[status]
                return (
                  <DropdownMenuItem key={status} onClick={() => onChangeStatus(status)} className={config.color}>
                    {statusIcons[status]}
                    <span className="ml-2">{config.label}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onAssignOwner && (
          <Button size="sm" variant="ghost" onClick={onAssignOwner}>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign
          </Button>
        )}

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          {onMove && (
            <Button size="sm" variant="ghost" onClick={onMove}>
              <Move className="h-4 w-4 mr-2" />
              Move
            </Button>
          )}

          {onCopy && (
            <Button size="sm" variant="ghost" onClick={onCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          )}

          {onShare && (
            <Button size="sm" variant="ghost" onClick={onShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}

          {onArchive && (
            <Button size="sm" variant="ghost" onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>

          <div className="h-4 w-px bg-border" />

          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

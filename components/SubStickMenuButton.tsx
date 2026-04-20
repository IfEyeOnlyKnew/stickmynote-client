"use client"

import type React from "react"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GitBranch, Plus, Eye, EyeOff } from "lucide-react"

interface SubStickMenuButtonProps {
  readonly hasSubSticks: boolean
  readonly isShowingSubSticks: boolean
  readonly onCreateSubStick: () => void
  readonly onToggleShowSubSticks?: () => void
  // Color for the indicator dot (only rendered when hasSubSticks is true).
  // Defaults to a neutral color when not provided.
  readonly indicatorColor?: string
  readonly className?: string
}

// Shared sub-stick affordance. When the stick has no children yet, clicking
// the icon creates a sub-stick directly. When it already has children, the
// icon opens a small popover with Show/Hide + Create. Used on every surface
// where sub-stick creation is offered (personal/alliance pads/mysticks/quicksticks).
export function SubStickMenuButton({
  hasSubSticks,
  isShowingSubSticks,
  onCreateSubStick,
  onToggleShowSubSticks,
  indicatorColor,
  className,
}: SubStickMenuButtonProps) {
  const [open, setOpen] = useState(false)

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasSubSticks) {
      onCreateSubStick()
      return
    }
    setOpen((prev) => !prev)
  }

  const handleCreate = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(false)
    onCreateSubStick()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(false)
    onToggleShowSubSticks?.()
  }

  const dotColor = indicatorColor && indicatorColor !== "#e5e7eb" ? indicatorColor : "#9ca3af"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={handleTriggerClick}
          className={`relative p-1 rounded hover:bg-gray-100 transition-colors ${className ?? ""}`}
          title={hasSubSticks ? "Sub Sticks" : "Create Sub Stick"}
        >
          <GitBranch className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          {hasSubSticks && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ backgroundColor: dotColor }}
              aria-hidden="true"
            />
          )}
        </button>
      </PopoverTrigger>
      {hasSubSticks && (
        <PopoverContent
          className="w-48 p-1"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {onToggleShowSubSticks && (
            <button
              type="button"
              onClick={handleToggle}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left"
            >
              {isShowingSubSticks ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide Sub Sticks
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Show Sub Sticks
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCreate}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left"
          >
            <Plus className="w-4 h-4" />
            Create Sub Stick
          </button>
        </PopoverContent>
      )}
    </Popover>
  )
}

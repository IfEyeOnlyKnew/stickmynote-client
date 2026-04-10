"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type React from "react"

interface NoteFullscreenHeaderProps {
  readonly onClose?: () => void
}

export const NoteFullscreenHeader: React.FC<NoteFullscreenHeaderProps> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">{/* Header content can be expanded here if needed */}</div>
      <div className="flex items-center gap-1">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} title="Close fullscreen">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

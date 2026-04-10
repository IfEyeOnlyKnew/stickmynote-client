"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import type { Note } from "@/types/note"

interface NotePanelActionsProps {
  readonly note: Note
  readonly isNewNote: boolean
  readonly onCancelNewNote?: (noteId: string) => void
  readonly onStickNewNote?: (noteId: string) => void
  readonly onEditingChange: (isEditing: boolean) => void
}

export const NotePanelActions: React.FC<NotePanelActionsProps> = ({
  note,
  isNewNote,
  onCancelNewNote,
  onStickNewNote,
  onEditingChange,
}) => {
  if (!isNewNote) {
    // In panel mode, editing actions are typically disabled
    // since the content should be read-only
    return null
  }

  return (
    <div className="mt-4 pt-3 border-t border-gray-200">
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            if (onCancelNewNote) onCancelNewNote(note.id)
          }}
          className="text-xs bg-transparent"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            if (onStickNewNote) {
              onStickNewNote(note.id)
              onEditingChange(false)
            }
          }}
          className="text-xs"
        >
          Stick
        </Button>
      </div>
    </div>
  )
}

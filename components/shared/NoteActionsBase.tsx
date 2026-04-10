"use client"

import { Button } from "@/components/ui/button"
import type React from "react"

export interface NoteActionsBaseProps {
  readonly isNewNote: boolean
  readonly isEditing: boolean
  readonly hasChanges: boolean
  readonly editedTopic: string
  readonly editedContent: string
  readonly isSaving: boolean
  readonly noteId: string
  readonly onCancelNewNote?: (noteId: string) => void
  readonly onStickNewNote?: (noteId: string) => void
  readonly onCancelEdit: (e: React.MouseEvent) => void
  readonly onStickEdit: (e: React.MouseEvent) => Promise<void>
  readonly setIsEditing: (editing: boolean) => void
  // Render the edit action row whenever isEditing is true, regardless of
  // hasChanges / content state. Fullscreen uses this; card uses the default.
  readonly showEditActionsAlways?: boolean
}

export const NoteActionsBase: React.FC<NoteActionsBaseProps> = ({
  isNewNote,
  isEditing,
  hasChanges,
  editedTopic,
  editedContent,
  isSaving,
  noteId,
  onCancelNewNote,
  onStickNewNote,
  onCancelEdit,
  onStickEdit,
  setIsEditing,
  showEditActionsAlways = false,
}) => {
  if (isNewNote) {
    return (
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              if (onCancelNewNote) onCancelNewNote(noteId)
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
                onStickNewNote(noteId)
                setIsEditing(false)
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

  const editActionsVisible = showEditActionsAlways
    ? isEditing
    : isEditing && hasChanges && (editedTopic.trim() || editedContent.trim())

  if (editActionsVisible) {
    return (
      <div className="flex gap-2 justify-end mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancelEdit}
          className="text-xs h-6 bg-white hover:bg-gray-50"
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onStickEdit}
          className="text-xs h-6 bg-gray-800 hover:bg-gray-900 text-white"
          disabled={!hasChanges || isSaving || !editedContent.trim()}
        >
          {isSaving ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            "Stick"
          )}
        </Button>
      </div>
    )
  }

  return null
}

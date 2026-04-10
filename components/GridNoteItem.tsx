"use client"

import { memo, useMemo } from "react"
import type { Note } from "@/types/note"
import { UnifiedNote } from "./UnifiedNote"
import type { NoteEventHandlers, NoteReplyHandlers, NoteStateManagement, NoteConfiguration } from "@/types/note-props"

interface GridNoteItemProps {
  readonly note: Note
  readonly itemWidth: number
  readonly eventHandlers: NoteEventHandlers
  readonly replyHandlers: NoteReplyHandlers
  readonly stateManagement: NoteStateManagement
  readonly configuration: NoteConfiguration
  readonly hasActiveReplyForm?: (noteId: string) => boolean
}

export const GridNoteItem = memo<GridNoteItemProps>(
  ({ note, itemWidth, eventHandlers, replyHandlers, stateManagement, configuration, hasActiveReplyForm }) => {
    const noteStateManagement = useMemo(
      (): NoteStateManagement => ({
        ...stateManagement,
        hasActiveReplyForm: hasActiveReplyForm ? hasActiveReplyForm(note.id) : false,
      }),
      [stateManagement, hasActiveReplyForm, note.id],
    )

    return (
      <div className="css-grid-item">
        <UnifiedNote
          note={note}
          windowSize={{ width: itemWidth, height: 400 }}
          {...eventHandlers}
          {...replyHandlers}
          {...noteStateManagement}
          {...configuration}
        />
      </div>
    )
  },
)

GridNoteItem.displayName = "GridNoteItem"

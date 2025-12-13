"use client"

import { useMemo } from "react"
import type { Note } from "@/types/note"
import type { NoteEventHandlers, NoteReplyHandlers, NoteStateManagement, NoteConfiguration } from "@/types/note-props"

interface UseNoteContextValueProps {
  note: Note
  eventHandlers: NoteEventHandlers
  replyHandlers: NoteReplyHandlers
  stateManagement: NoteStateManagement
  configuration: NoteConfiguration
}

export const useNoteContextValue = ({
  note,
  eventHandlers,
  replyHandlers,
  stateManagement,
  configuration,
}: UseNoteContextValueProps) => {
  const { currentUserId, readOnly = false, hideGenerateTags = false } = configuration
  const { isNewNote = false, generatingTags } = stateManagement

  return useMemo(() => {
    const isOwner = currentUserId === note.user_id

    return {
      // Core note data
      note,
      currentUserId,
      readOnly,
      isNewNote,
      isOwner,
      generatingTags,
      hideGenerateTags,

      // Spread grouped handlers to maintain existing context interface
      ...eventHandlers,
      ...replyHandlers,
      ...stateManagement,
    }
  }, [
    note,
    currentUserId,
    readOnly,
    isNewNote,
    generatingTags,
    hideGenerateTags,
    eventHandlers,
    replyHandlers,
    stateManagement,
  ])
}

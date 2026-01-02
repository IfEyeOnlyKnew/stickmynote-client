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
  const { isNewNote = false, generatingTags, summarizingLinks, tabsRefreshKeys } = stateManagement

  // Extract the refresh key for this specific note
  const tabsRefreshKey = tabsRefreshKeys?.[note.id] || 0

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
      summarizingLinks,
      hideGenerateTags,
      tabsRefreshKey,

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
    summarizingLinks,
    hideGenerateTags,
    tabsRefreshKey,
    eventHandlers,
    replyHandlers,
    stateManagement,
  ])
}

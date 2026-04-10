"use client"

import type React from "react"
import { createContext, useContext } from "react"
import type { Note } from "@/types/note"

interface NoteContextValue {
  note: Note
  currentUserId?: string
  readOnly: boolean
  isNewNote: boolean
  isOwner: boolean
  generatingTags?: string | null
  summarizingLinks?: string | null
  hideGenerateTags: boolean
  tabsRefreshKey?: number

  // Event handlers
  onOpenFullscreen?: (noteId: string) => void
  onClose?: () => void
  onUpdateSharing: (noteId: string, isShared: boolean) => void
  onUpdateColor: (noteId: string, color: string) => void
  onDeleteNote: (noteId: string) => void
  onTopicChange: (noteId: string, topic: string) => void
  onContentChange: (noteId: string, content: string) => void
  onDetailsChange: (noteId: string, details: string) => void
  onGenerateTags: (noteId: string, topic: string) => void
  onSummarizeLinks?: (noteId: string) => void
  onMouseDown?: (e: React.MouseEvent, noteId: string) => void
  onFocusTopicTextarea?: (noteId: string) => void
  onAddReply: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>

  // State management
  focusTopicId?: string | null
  onNoteHeightChange?: (noteId: string, height: number) => void
  onCancelNewNote?: (noteId: string) => void
  onStickNewNote?: (noteId: string) => void
  onReplyFormToggle?: (noteId: string, isVisible: boolean) => void
  hasActiveReplyForm?: boolean
  onEditStateChange?: (noteId: string, isEditing: boolean) => void
  hasUnsavedChanges?: boolean
  onNoteUpdate?: (updatedNote: Note) => void
  lastInteractedNote?: string | null
  onNoteInteraction?: (noteId: string) => void
}

const NoteContext = createContext<NoteContextValue | null>(null)

export const useNoteContext = () => {
  const context = useContext(NoteContext)
  if (!context) {
    throw new Error("useNoteContext must be used within a NoteProvider")
  }
  return context
}

interface NoteProviderProps {
  readonly children: React.ReactNode
  readonly value: NoteContextValue
}

export const NoteProvider: React.FC<NoteProviderProps> = ({ children, value }) => {
  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>
}

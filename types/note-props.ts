import type { Note } from "@/types/note"
import type React from "react"

export interface NoteEventHandlers {
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
  onNoteInteraction?: (noteId: string) => void
  onNoteHeightChange?: (noteId: string, height: number) => void
  onNoteUpdate?: (updatedNote: Note) => void
}

export interface NoteReplyHandlers {
  onAddReply: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  onReplyFormToggle?: (noteId: string, isVisible: boolean) => void
}

export interface NoteStateManagement {
  focusTopicId?: string | null
  isNewNote?: boolean
  onCancelNewNote?: (noteId: string) => void
  onStickNewNote?: (noteId: string) => void
  hasActiveReplyForm?: boolean
  onEditStateChange?: (noteId: string, isEditing: boolean) => void
  hasUnsavedChanges?: boolean
  lastInteractedNote?: string | null
  draggedNote?: string | null
  newNoteIds?: Set<string>
  generatingTags?: string | null
  summarizingLinks?: string | null
  tabsRefreshKeys?: Record<string, number>
}

export interface NoteConfiguration {
  mode: "card" | "fullscreen" | "panel"
  windowSize?: { width: number; height: number }
  currentUserId?: string
  readOnly?: boolean
  hideGenerateTags?: boolean
  onCancelNewNote?: (noteId: string) => void
  onStickNewNote?: (noteId: string) => void
  isNewNote?: boolean
}

export interface UnifiedNoteProps extends NoteEventHandlers, NoteReplyHandlers, NoteStateManagement, NoteConfiguration {
  note: Note
}

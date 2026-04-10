"use client"

import { NoteTabs } from "@/components/note-tabs"
import type React from "react"

interface NoteFullscreenContentProps {
  readonly noteId: string
  readonly topic: string
  readonly content: string
  readonly onTopicChange: (value: string) => void
  readonly onContentChange: (value: string) => void
  readonly onDetailsChange: (value: string) => void
  readonly onTopicFocus: () => void
  readonly onContentFocus: () => void
  readonly readOnly: boolean
  readonly resetKey: number
  readonly onTabChange: (tabName: string) => void
  readonly onNoteInteraction?: (noteId: string) => void
  readonly isEditing?: boolean
  readonly isNewNote?: boolean
  readonly onCancel?: () => void
  readonly onStick?: () => void
  readonly isSaving?: boolean
}

export const NoteFullscreenContent: React.FC<NoteFullscreenContentProps> = ({
  noteId,
  topic,
  content,
  onTopicChange,
  onContentChange,
  onDetailsChange,
  onTopicFocus,
  onContentFocus,
  readOnly,
  resetKey,
  onTabChange,
  onNoteInteraction,
  isEditing,
  isNewNote,
  onCancel,
  onStick,
  isSaving,
}) => {
  return (
    <NoteTabs
      noteId={noteId}
      initialTopic={topic}
      initialContent={content}
      initialDetails=""
      onTopicChange={onTopicChange}
      onContentChange={onContentChange}
      onDetailsChange={onDetailsChange}
      onTopicFocus={onTopicFocus}
      onContentFocus={onContentFocus}
      readOnly={readOnly}
      resetKey={resetKey}
      onTabChange={(tabName) => {
        onTabChange(tabName)
        onNoteInteraction?.(noteId)
      }}
      showMedia={true}
      isEditing={isEditing || isNewNote}
      onCancel={onCancel}
      onStick={onStick}
      isSaving={isSaving}
      stickType="personal"
    />
  )
}

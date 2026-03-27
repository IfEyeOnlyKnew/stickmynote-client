"use client"

import { NoteTabs } from "@/components/note-tabs"
import type React from "react"

interface NoteFullscreenContentProps {
  noteId: string
  topic: string
  content: string
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onTopicFocus: () => void
  onContentFocus: () => void
  readOnly: boolean
  resetKey: number
  onTabChange: (tabName: string) => void
  onNoteInteraction?: (noteId: string) => void
  isEditing?: boolean
  isNewNote?: boolean
  onCancel?: () => void
  onStick?: () => void
  isSaving?: boolean
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

"use client"

import { NoteTabs } from "@/components/note-tabs"
import type React from "react"

interface NoteCardContentProps {
  noteId: string
  initialTopic: string
  initialContent: string
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onTopicFocus: () => void
  onContentFocus: () => void
  readOnly: boolean
  resetKey: number
  onTabChange: (tabName: string) => void
  onNoteInteraction?: (noteId: string) => void
}

export const NoteCardContent: React.FC<NoteCardContentProps> = ({
  noteId,
  initialTopic,
  initialContent,
  onTopicChange,
  onContentChange,
  onDetailsChange,
  onTopicFocus,
  onContentFocus,
  readOnly,
  resetKey,
  onTabChange,
  onNoteInteraction,
}) => {
  return (
    <NoteTabs
      noteId={noteId}
      initialTopic={initialTopic}
      initialContent={initialContent}
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
      showMedia={false}
    />
  )
}

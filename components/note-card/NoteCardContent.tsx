"use client"

import { NoteTabs } from "@/components/note-tabs"
import type React from "react"

interface NoteCardContentProps {
  readonly noteId: string
  readonly initialTopic: string
  readonly initialContent: string
  readonly onTopicChange: (value: string) => void
  readonly onContentChange: (value: string) => void
  readonly onDetailsChange: (value: string) => void
  readonly onTopicFocus: () => void
  readonly onContentFocus: () => void
  readonly readOnly: boolean
  readonly resetKey: number
  readonly onTabChange: (tabName: string) => void
  readonly onNoteInteraction?: (noteId: string) => void
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
      stickType="personal"
    />
  )
}

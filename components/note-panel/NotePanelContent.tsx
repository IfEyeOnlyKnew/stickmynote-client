"use client"

import type React from "react"

import { NoteTabs } from "@/components/note-tabs"
import type { Note } from "@/types/note"

interface NotePanelContentProps {
  readonly note: Note
  readonly resetKey: number
  readonly onTopicChange: (topic: string) => void
  readonly onContentChange: (content: string) => void
  readonly onDetailsChange: (details: string) => void
  readonly onStartEditing: () => void
  readonly onNoteInteraction?: (noteId: string) => void
  readonly onTabChange: (tabName: string) => void
  readonly isNewNote: boolean
  readonly isEditing: boolean
  readonly readOnly: boolean
}

export const NotePanelContent: React.FC<NotePanelContentProps> = ({
  note,
  resetKey,
  onTopicChange,
  onContentChange,
  onDetailsChange,
  onStartEditing,
  onNoteInteraction,
  onTabChange,
  isNewNote,
  isEditing,
  readOnly,
}) => {
  return (
    <NoteTabs
      noteId={note.id}
      initialTopic={note.topic || note.title || ""}
      initialContent={note.content || ""}
      initialDetails=""
      onTopicChange={onTopicChange}
      onContentChange={onContentChange}
      onDetailsChange={onDetailsChange}
      onTopicFocus={() => !isNewNote && !isEditing && !readOnly && onStartEditing()}
      onContentFocus={() => !isNewNote && !isEditing && !readOnly && onStartEditing()}
      readOnly={true} // Panel mode is always read-only for note content
      resetKey={resetKey}
      onTabChange={(tabName) => {
        onTabChange(tabName)
        onNoteInteraction?.(note.id)
      }}
      showMedia={false} // No media in panel mode
      stickType="personal"
    />
  )
}

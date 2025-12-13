"use client"

import type React from "react"

import { NoteTabs } from "@/components/note-tabs"
import type { Note } from "@/types/note"

interface NotePanelContentProps {
  note: Note
  resetKey: number
  onTopicChange: (topic: string) => void
  onContentChange: (content: string) => void
  onDetailsChange: (details: string) => void
  onStartEditing: () => void
  onNoteInteraction?: (noteId: string) => void
  onTabChange: (tabName: string) => void
  isNewNote: boolean
  isEditing: boolean
  readOnly: boolean
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
    />
  )
}

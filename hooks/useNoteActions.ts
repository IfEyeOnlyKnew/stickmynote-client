"use client"

import type React from "react"

import { useCallback } from "react"
import type { Note } from "@/types/note"

interface UseNoteActionsProps {
  note: Note
  isNewNote: boolean
  readOnly: boolean
  isEditing: boolean
  setIsEditing: (editing: boolean) => void
  editedTopic: string
  setEditedTopic: (topic: string) => void
  editedContent: string
  setEditedContent: (content: string) => void
  editedDetails: string
  setEditedDetails: (details: string) => void
  originalTopic: string
  setOriginalTopic: (topic: string) => void
  originalContent: string
  setOriginalContent: (content: string) => void
  originalDetails: string
  setOriginalDetails: (details: string) => void
  isSaving: boolean
  setIsSaving: (saving: boolean) => void
  setResetKey: (key: number | ((prev: number) => number)) => void
  hasChanges: boolean
  onTopicChange: (noteId: string, topic: string) => void
  onContentChange: (noteId: string, content: string) => void
  onDetailsChange: (noteId: string, details: string) => void
  onNoteUpdate?: (updatedNote: Note) => void
  onNoteInteraction?: (noteId: string) => void
}

export const useNoteActions = ({
  note,
  isNewNote,
  readOnly,
  isEditing,
  setIsEditing,
  editedTopic,
  setEditedTopic,
  editedContent,
  setEditedContent,
  editedDetails,
  setEditedDetails,
  originalTopic,
  setOriginalTopic,
  originalContent,
  setOriginalContent,
  originalDetails,
  setOriginalDetails,
  isSaving,
  setIsSaving,
  setResetKey,
  hasChanges,
  onTopicChange,
  onContentChange,
  onDetailsChange,
  onNoteUpdate,
  onNoteInteraction,
}: UseNoteActionsProps) => {
  const handleStartEditing = useCallback(() => {
    if (!isNewNote && !readOnly && onNoteInteraction) {
      onNoteInteraction(note.id)
      setIsEditing(true)
      const newTopic = note.topic || note.title || ""
      const newContent = note.content || ""
      setEditedTopic(newTopic)
      setEditedContent(newContent)
      setOriginalTopic(newTopic)
      setOriginalContent(newContent)
    }
  }, [
    isNewNote,
    readOnly,
    onNoteInteraction,
    note.id,
    note.topic,
    note.title,
    note.content,
    setIsEditing,
    setEditedTopic,
    setEditedContent,
    setOriginalTopic,
    setOriginalContent,
  ])

  const handleCancelEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsEditing(false)
      setEditedTopic(originalTopic)
      setEditedContent(originalContent)
      setResetKey((prev) => prev + 1)
      onTopicChange(note.id, originalTopic)
      onContentChange(note.id, originalContent)
    },
    [
      originalTopic,
      originalContent,
      onTopicChange,
      onContentChange,
      note.id,
      setIsEditing,
      setEditedTopic,
      setEditedContent,
      setResetKey,
    ],
  )

  const handleStickEdit = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const trimmedTopic = editedTopic.trim()
      const trimmedContent = editedContent.trim()

      if (!hasChanges || isSaving || !trimmedContent) return

      setIsSaving(true)
      try {
        const response = await fetch(`/api/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: trimmedTopic,
            content: trimmedContent,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("Server error:", response.status, errorText)
          throw new Error(`Server error: ${response.status}`)
        }

        const updatedNote = await response.json()

        setOriginalTopic(trimmedTopic)
        setOriginalContent(trimmedContent)
        setIsEditing(false)

        onNoteUpdate?.(updatedNote)
        onTopicChange(note.id, trimmedTopic)
        onContentChange(note.id, trimmedContent)
      } catch (error) {
        console.error("Error saving note:", error)
        alert("Failed to save note. Please try again.")
      } finally {
        setIsSaving(false)
      }
    },
    [
      editedTopic,
      editedContent,
      hasChanges,
      isSaving,
      note.id,
      onNoteUpdate,
      onTopicChange,
      onContentChange,
      setOriginalTopic,
      setOriginalContent,
      setIsEditing,
      setIsSaving,
    ],
  )

  const handleTopicChangeInternal = useCallback(
    (topic: string) => {
      setEditedTopic(topic)
      if (!isEditing && !isNewNote) handleStartEditing()
      if (!isEditing || isNewNote) onTopicChange(note.id, topic)
    },
    [isEditing, isNewNote, handleStartEditing, onTopicChange, note.id, setEditedTopic],
  )

  const handleContentChangeInternal = useCallback(
    (content: string) => {
      setEditedContent(content)
      if (!isEditing && !isNewNote) handleStartEditing()
      if (!isEditing || isNewNote) onContentChange(note.id, content)
    },
    [isEditing, isNewNote, handleStartEditing, onContentChange, note.id, setEditedContent],
  )

  const handleDetailsChangeInternal = useCallback(
    (details: string) => {
      setEditedDetails(details)
      if (!isEditing && !isNewNote) handleStartEditing()
      if (!isEditing || isNewNote) onDetailsChange(note.id, details)
    },
    [isEditing, isNewNote, handleStartEditing, onDetailsChange, note.id, setEditedDetails],
  )

  return {
    handleStartEditing,
    handleCancelEdit,
    handleStickEdit,
    handleTopicChangeInternal,
    handleContentChangeInternal,
    handleDetailsChangeInternal,
  }
}

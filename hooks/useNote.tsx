"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import type React from "react"
import type { Note } from "@/types/note"

interface UseNoteOptions {
  isNewNote?: boolean
  readOnly?: boolean
  onTopicChange?: (noteId: string, topic: string) => void
  onContentChange?: (noteId: string, content: string) => void
  onDetailsChange?: (noteId: string, details: string) => void
  onNoteUpdate?: (updatedNote: Note) => void
  onNoteInteraction?: (noteId: string) => void
}

export const useNote = (note: Note, options: UseNoteOptions = {}) => {
  const {
    isNewNote = false,
    readOnly = false,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onNoteUpdate,
    onNoteInteraction,
  } = options

  // Reply form state
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const [replyColor, setReplyColor] = useState<string | undefined>(undefined)
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  // Tab and UI state
  const [activeTab, setActiveTab] = useState<string>("main")
  const [resetKey, setResetKey] = useState(0)

  // Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [replySummary, setReplySummary] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState<string>("casual")

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editedTopic, setEditedTopic] = useState<string>(note.topic || note.title || "")
  const [editedContent, setEditedContent] = useState<string>(note.content || "")
  const [editedDetails, setEditedDetails] = useState<string>("")
  const [originalTopic, setOriginalTopic] = useState<string>(note.topic || note.title || "")
  const [originalContent, setOriginalContent] = useState<string>(note.content || "")
  const [originalDetails, setOriginalDetails] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  // Computed values
  const replies = useMemo(() => note.replies || [], [note.replies])
  const replyCount = useMemo(() => replies.length, [replies.length])
  const hasChanges = useMemo(
    () => editedTopic !== originalTopic || editedContent !== originalContent || editedDetails !== originalDetails,
    [editedTopic, originalTopic, editedContent, originalContent, editedDetails, originalDetails],
  )

  const tones = [
    { value: "cinematic", label: "Cinematic (Movie Script)" },
    { value: "formal", label: "Formal (Professional Report)" },
    { value: "casual", label: "Casual (Conversational)" },
    { value: "dramatic", label: "Dramatic (Novel Narrative)" },
  ]

  // Helper functions
  const resetReplyForm = useCallback(() => {
    setShowReplyForm(false)
    setReplyContent("")
    setReplyColor(undefined)
  }, [])

  const initializeEditingState = useCallback(() => {
    const newTopic = note.topic || note.title || ""
    const newContent = note.content || ""
    setOriginalTopic(newTopic)
    setOriginalContent(newContent)
    setEditedTopic(newTopic)
    setEditedContent(newContent)
  }, [note.topic, note.title, note.content])

  useEffect(() => {
    const newTopic = note.topic || note.title || ""
    const newContent = note.content || ""

    if (!isEditing) {
      setEditedTopic(newTopic)
      setEditedContent(newContent)
      setOriginalTopic(newTopic)
      setOriginalContent(newContent)
    }
  }, [note.id, isEditing])

  // Action handlers (only available when callbacks are provided)
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
  }, [isNewNote, readOnly, onNoteInteraction, note.id, note.topic, note.title, note.content])

  const handleCancelEdit = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      console.log("[v0] handleCancelEdit - Discarding changes, resetting to original values")
      setIsEditing(false)
      setEditedTopic(originalTopic)
      setEditedContent(originalContent)
      setResetKey((prev) => prev + 1)
    },
    [originalTopic, originalContent],
  )

  const handleStickEdit = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation()
      const trimmedTopic = editedTopic.trim()
      const trimmedContent = editedContent.trim()

      if (!hasChanges || isSaving || !trimmedContent) {
        console.log("[v0] handleStickEdit - Skipping save:", { hasChanges, isSaving, hasContent: !!trimmedContent })
        return
      }

      console.log("[v0] handleStickEdit starting save:", {
        noteId: note.id,
        trimmedTopic,
        contentLength: trimmedContent.length,
      })

      setIsSaving(true)
      try {
        const response = await fetch(`/api/update-note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: note.id,
            topic: trimmedTopic,
            content: trimmedContent,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] Server error:", response.status, errorText)
          throw new Error(`Server error: ${response.status}`)
        }

        const updatedNote = await response.json()
        console.log("[v0] Note saved successfully, calling onNoteUpdate:", updatedNote)

        setOriginalTopic(trimmedTopic)
        setOriginalContent(trimmedContent)
        setEditedTopic(trimmedTopic)
        setEditedContent(trimmedContent)
        setIsEditing(false)

        if (onNoteUpdate) {
          console.log("[v0] Calling onNoteUpdate callback")
          onNoteUpdate(updatedNote)
        } else {
          console.warn("[v0] onNoteUpdate callback not provided")
        }

        if (onTopicChange) onTopicChange(note.id, trimmedTopic)
        if (onContentChange) onContentChange(note.id, trimmedContent)
      } catch (error) {
        console.error("[v0] Error saving note:", error)
        alert("Failed to save note. Please try again.")
      } finally {
        setIsSaving(false)
        console.log("[v0] handleStickEdit completed")
      }
    },
    [editedTopic, editedContent, hasChanges, isSaving, note.id, onNoteUpdate, onTopicChange, onContentChange],
  )

  const handleTopicChangeInternal = useCallback(
    (topic: string) => {
      setEditedTopic(topic)
      if (!isEditing && !isNewNote && !readOnly) {
        setIsEditing(true)
        setOriginalTopic(note.topic || note.title || "")
        setOriginalContent(note.content || "")
        if (onNoteInteraction) onNoteInteraction(note.id)
      }
      // Only call parent onTopicChange for new notes (immediate save mode)
      if (isNewNote && onTopicChange) onTopicChange(note.id, topic)
    },
    [isEditing, isNewNote, readOnly, note.topic, note.title, note.content, note.id, onTopicChange, onNoteInteraction],
  )

  const handleContentChangeInternal = useCallback(
    (content: string) => {
      setEditedContent(content)
      if (!isEditing && !isNewNote && !readOnly) {
        setIsEditing(true)
        setOriginalTopic(note.topic || note.title || "")
        setOriginalContent(note.content || "")
        if (onNoteInteraction) onNoteInteraction(note.id)
      }
      // Only call parent onContentChange for new notes (immediate save mode)
      if (isNewNote && onContentChange) onContentChange(note.id, content)
    },
    [isEditing, isNewNote, readOnly, note.topic, note.title, note.content, note.id, onContentChange, onNoteInteraction],
  )

  const handleDetailsChangeInternal = useCallback(
    (details: string) => {
      // Details are managed by DetailsTabContent with its own save mechanism
      if (onDetailsChange) onDetailsChange(note.id, details)
    },
    [onDetailsChange, note.id],
  )

  return {
    // State values
    showReplyForm,
    setShowReplyForm,
    replyContent,
    setReplyContent,
    replyColor,
    setReplyColor,
    isSubmittingReply,
    setIsSubmittingReply,
    activeTab,
    setActiveTab,
    resetKey,
    setResetKey,
    isGeneratingSummary,
    setIsGeneratingSummary,
    replySummary,
    setReplySummary,
    selectedTone,
    setSelectedTone,
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

    // Computed values
    replies,
    replyCount,
    hasChanges,
    tones,

    // Helper functions
    resetReplyForm,
    initializeEditingState,

    // Action handlers (available when options are provided)
    handleStartEditing,
    handleCancelEdit,
    handleStickEdit,
    handleTopicChangeInternal,
    handleContentChangeInternal,
    handleDetailsChangeInternal,
  }
}

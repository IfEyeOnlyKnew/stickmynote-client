"use client"

import { Card, CardContent } from "@/components/ui/card"
import { getTimestampDisplay } from "@/utils/noteUtils"
import type React from "react"
import { useRef, useEffect, useMemo, useCallback, useState } from "react"
import { useNoteContext } from "./NoteContext"
import { useNote } from "@/hooks/useNote"
import { NoteCardHeader } from "./note-card/NoteCardHeader"
import { NoteCardContent } from "./note-card/NoteCardContent"
import { NoteCardActions } from "./note-card/NoteCardActions"
import { NoteCardMetadata } from "./note-card/NoteCardMetadata"
import { NoteCardReplies } from "./note-card/NoteCardReplies"

interface UnifiedNoteCardProps {
  readonly windowSize?: { width: number; height: number }
  draggedNote?: string | null
  lastInteractedNote?: string | null
}

export const UnifiedNoteCard: React.FC<UnifiedNoteCardProps> = ({ windowSize, draggedNote, lastInteractedNote }) => {
  const context = useNoteContext()
  const {
    note,
    readOnly,
    isNewNote,
    isOwner,
    generatingTags,
    summarizingLinks,
    hideGenerateTags,
    tabsRefreshKey,
    onOpenFullscreen,
    onUpdateSharing,
    onUpdateColor, // Get onUpdateColor from context
    onDeleteNote,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onGenerateTags,
    onSummarizeLinks,
    onMouseDown,
    onNoteHeightChange,
    onCancelNewNote,
    onStickNewNote,
    onReplyFormToggle,
    onEditStateChange,
    onNoteUpdate,
    onNoteInteraction,
    onAddReply,
  } = context

  const cardRef = useRef<HTMLDivElement>(null)

  const [noteColor, setNoteColor] = useState(note.color || "#ffffff")

  useEffect(() => {
    setNoteColor(note.color || "#ffffff")
  }, [note.color])

  const {
    showReplyForm,
    setShowReplyForm,
    replyContent,
    setReplyContent,
    replyColor,
    isSubmittingReply,
    setIsSubmittingReply,
    activeTab,
    setActiveTab,
    isEditing,
    setIsEditing,
    editedTopic,
    editedContent,
    isSaving,
    replyCount,
    hasChanges,
    resetReplyForm,
    initializeEditingState,
    handleStartEditing,
    handleCancelEdit,
    handleStickEdit,
    handleTopicChangeInternal,
    handleContentChangeInternal,
    handleDetailsChangeInternal,
    resetKey,
  } = useNote(note, {
    isNewNote,
    readOnly,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onNoteUpdate,
    onNoteInteraction,
  })

  // Container classes for card mode
  const containerClasses = useMemo(() => {
    const baseClasses = "note-card-positioned note-card-width dynamic-position"
    const stateClasses: string[] = []

    if (draggedNote === note.id) stateClasses.push("dragging")
    if (isNewNote) stateClasses.push("border-blue-500 border-2")
    if (showReplyForm) stateClasses.push("expanded reply-form-active")
    if (activeTab && activeTab !== "main") stateClasses.push("tab-active focused")

    return `${baseClasses} ${stateClasses.join(" ")}`
  }, [draggedNote, note.id, isNewNote, showReplyForm, activeTab])

  // Initialize editing state when note changes
  useEffect(() => {
    if (!isEditing) {
      initializeEditingState()
    }
  }, [note.topic, note.title, note.content, isEditing, initializeEditingState])

  // Notify parent of editing state changes
  useEffect(() => {
    onEditStateChange?.(note.id, isEditing)
  }, [isEditing, note.id, onEditStateChange])

  // Handle card positioning and z-index
  useEffect(() => {
    if (!cardRef.current) return

    const element = cardRef.current
    element.style.setProperty("--note-x", `${note.position_x || 0}px`)
    element.style.setProperty("--note-y", `${note.position_y || 0}px`)
    element.style.setProperty("--note-color", noteColor)

    let zIndex = 1
    if (isNewNote) zIndex = 10000
    else if (draggedNote === note.id) zIndex = 9999
    else if (showReplyForm) zIndex = 1001
    else if (activeTab && activeTab !== "main") zIndex = 1002
    else if (lastInteractedNote === note.id) zIndex = 100

    element.style.setProperty("--note-z-index", String(zIndex))
    element.style.zIndex = String(zIndex)
  }, [
    note.position_x,
    note.position_y,
    draggedNote,
    note.id,
    showReplyForm,
    activeTab,
    isNewNote,
    lastInteractedNote,
    noteColor,
  ])

  // Handle height changes for card mode
  useEffect(() => {
    if (!cardRef.current || !onNoteHeightChange) return

    const element = cardRef.current
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onNoteHeightChange(note.id, entry.contentRect.height)
      }
    })

    resizeObserver.observe(element)
    onNoteHeightChange(note.id, element.offsetHeight)

    return () => resizeObserver.disconnect()
  }, [note.id, onNoteHeightChange])

  // Reply handlers
  const handleAddReplyClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setShowReplyForm(true)
      setReplyContent("")
      onReplyFormToggle?.(note.id, true)
    },
    [note.id, onReplyFormToggle, setShowReplyForm, setReplyContent],
  )

  const handleCancelReply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      resetReplyForm()
      onReplyFormToggle?.(note.id, false)
    },
    [note.id, onReplyFormToggle, resetReplyForm],
  )

  const handleStickReply = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const trimmedContent = replyContent.trim()
      if (!trimmedContent || isSubmittingReply) return

      setIsSubmittingReply(true)
      try {
        await onAddReply(note.id, trimmedContent, replyColor)
        resetReplyForm()
        onReplyFormToggle?.(note.id, false)
      } catch (error) {
        console.error("Error submitting reply:", error)
      } finally {
        setIsSubmittingReply(false)
      }
    },
    [
      replyContent,
      isSubmittingReply,
      onAddReply,
      note.id,
      replyColor,
      onReplyFormToggle,
      resetReplyForm,
      setIsSubmittingReply,
    ],
  )

  // Mouse event handlers
  const handleCardMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onMouseDown) return

      const target = e.target as HTMLElement
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("button") ||
        target.tagName === "A"

      if (!isInputElement && onNoteInteraction) {
        onNoteInteraction(note.id)
        onMouseDown(e, note.id)
      }
    },
    [onMouseDown, onNoteInteraction, note.id],
  )

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onNoteInteraction) return

      const target = e.target as HTMLElement
      const isInteractiveElement =
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"

      if (!isInteractiveElement) {
        onNoteInteraction(note.id)
      }
    },
    [onNoteInteraction, note.id],
  )

  const handleColorChange = useCallback(
    (noteId: string, color: string) => {
      try {
        setNoteColor(color)
        onUpdateColor(noteId, color)
        if (onNoteUpdate) {
          const updatedNote = { ...note, color }
          onNoteUpdate(updatedNote)
        }
      } catch (error) {
        console.error("Error updating note color:", error)
        // Revert color on error
        setNoteColor(note.color || "#ffffff")
      }
    },
    [note, onUpdateColor, onNoteUpdate],
  )

  return (
    <Card
      ref={cardRef}
      className={`${containerClasses} relative transition-shadow duration-200`}
      data-note-id={note.id}
      onMouseDown={handleCardMouseDown}
      onClick={handleCardClick}
      style={{
        backgroundColor: "#ffffff",
        borderColor: noteColor,
        borderWidth: "3px",
        borderStyle: "solid",
        boxShadow: `0 10px 20px -5px ${noteColor}60, 0 4px 10px -3px ${noteColor}40`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 20px 30px -5px ${noteColor}70, 0 8px 15px -3px ${noteColor}50`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 10px 20px -5px ${noteColor}60, 0 4px 10px -3px ${noteColor}40`
      }}
    >
      <CardContent className="p-4 text-gray-900 relative">
        {!isNewNote && (
          <NoteCardHeader
            noteId={note.id}
            isShared={note.is_shared}
            currentColor={noteColor}
            onOpenFullscreen={onOpenFullscreen}
            onUpdateSharing={onUpdateSharing}
            onDeleteNote={onDeleteNote}
            onColorChange={handleColorChange}
          />
        )}

        <NoteCardContent
          noteId={note.id}
          initialTopic={note.topic || note.title || ""}
          initialContent={note.content || ""}
          onTopicChange={handleTopicChangeInternal}
          onContentChange={handleContentChangeInternal}
          onDetailsChange={handleDetailsChangeInternal}
          onTopicFocus={() => !isNewNote && !isEditing && !readOnly && handleStartEditing()}
          onContentFocus={() => !isNewNote && !isEditing && !readOnly && handleStartEditing()}
          readOnly={readOnly || (!isOwner && !isNewNote)}
          resetKey={resetKey + (tabsRefreshKey || 0)}
          onTabChange={setActiveTab}
          onNoteInteraction={onNoteInteraction}
        />

        <NoteCardActions
          isNewNote={isNewNote}
          isEditing={isEditing}
          hasChanges={hasChanges}
          editedTopic={editedTopic}
          editedContent={editedContent}
          isSaving={isSaving}
          noteId={note.id}
          onCancelNewNote={onCancelNewNote}
          onStickNewNote={onStickNewNote}
          onCancelEdit={handleCancelEdit}
          onStickEdit={handleStickEdit}
          setIsEditing={setIsEditing}
        />

        <NoteCardMetadata
          noteId={note.id}
          tags={note.tags}
          hyperlinks={note.hyperlinks}
          isNewNote={isNewNote}
          hideGenerateTags={hideGenerateTags}
          generatingTags={generatingTags}
          summarizingLinks={summarizingLinks}
          topic={note.topic}
          title={note.title}
          content={note.content}
          onGenerateTags={onGenerateTags}
          onSummarizeLinks={onSummarizeLinks}
        />

        <NoteCardReplies
          noteId={note.id}
          isNewNote={isNewNote}
          replyCount={replyCount}
          showReplyForm={showReplyForm}
          replyContent={replyContent}
          isSubmittingReply={isSubmittingReply}
          onOpenFullscreen={onOpenFullscreen}
          onAddReplyClick={handleAddReplyClick}
          onCancelReply={handleCancelReply}
          onStickReply={handleStickReply}
          setReplyContent={setReplyContent}
        />

        {!isNewNote && (
          <div className="absolute bottom-1 right-1 text-xs text-gray-500 pointer-events-none bg-white/80 px-1 rounded">
            {getTimestampDisplay(note.created_at, note.updated_at)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

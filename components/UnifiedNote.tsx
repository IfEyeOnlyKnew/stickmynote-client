"use client"
import type React from "react"
import { NoteProvider } from "./NoteContext"
import { UnifiedNoteCard } from "./UnifiedNoteCard"
import { UnifiedNoteFullscreen } from "./UnifiedNoteFullscreen"
import { UnifiedNotePanel } from "./UnifiedNotePanel"
import { useNoteContextValue } from "@/hooks/use-note-context-value"
import type { UnifiedNoteProps } from "@/types/note-props"

const UnifiedNote: React.FC<UnifiedNoteProps> = (props) => {
  const {
    note,
    mode,
    windowSize,
    draggedNote,
    lastInteractedNote,
    // Group event handlers
    onOpenFullscreen,
    onClose,
    onUpdateSharing,
    onUpdateColor,
    onDeleteNote,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onGenerateTags,
    onSummarizeLinks,
    onMouseDown,
    onFocusTopicTextarea,
    // Group reply handlers
    onAddReply,
    onEditReply,
    onDeleteReply,
    // Group state management
    focusTopicId,
    onNoteHeightChange,
    isNewNote,
    onCancelNewNote,
    onStickNewNote,
    onReplyFormToggle,
    hasActiveReplyForm,
    onEditStateChange,
    hasUnsavedChanges,
    onNoteUpdate,
    onNoteInteraction,
    // Group configuration
    generatingTags,
    summarizingLinks,
    currentUserId,
    readOnly,
    hideGenerateTags,
  } = props

  const eventHandlers = {
    onOpenFullscreen,
    onClose,
    onUpdateSharing,
    onUpdateColor,
    onDeleteNote,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onGenerateTags,
    onSummarizeLinks,
    onMouseDown,
    onFocusTopicTextarea,
  }

  const replyHandlers = {
    onAddReply,
    onEditReply,
    onDeleteReply,
  }

  const stateManagement = {
    focusTopicId,
    onNoteHeightChange,
    isNewNote,
    onCancelNewNote,
    onStickNewNote,
    onReplyFormToggle,
    hasActiveReplyForm,
    onEditStateChange,
    hasUnsavedChanges,
    onNoteUpdate,
    lastInteractedNote,
    onNoteInteraction,
    generatingTags,
    summarizingLinks,
  }

  const configuration = {
    mode,
    windowSize,
    draggedNote,
    currentUserId,
    readOnly,
    hideGenerateTags,
  }

  const contextValue = useNoteContextValue({
    note,
    eventHandlers,
    replyHandlers,
    stateManagement,
    configuration,
  })

  const renderNoteComponent = () => {
    switch (mode) {
      case "card":
        return (
          <UnifiedNoteCard windowSize={windowSize} draggedNote={draggedNote} lastInteractedNote={lastInteractedNote} />
        )
      case "fullscreen":
        return <UnifiedNoteFullscreen />
      case "panel":
        return <UnifiedNotePanel />
      default:
        return null
    }
  }

  return <NoteProvider value={contextValue}>{renderNoteComponent()}</NoteProvider>
}

UnifiedNote.displayName = "UnifiedNote"

export { UnifiedNote }

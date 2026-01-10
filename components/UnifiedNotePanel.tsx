"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getTimestampDisplay } from "@/utils/noteUtils"
import type React from "react"
import { useEffect, useCallback } from "react"
import { useNoteContext } from "./NoteContext"
import { useNote } from "@/hooks/useNote"
import { NotePanelHeader } from "./note-panel/NotePanelHeader"
import { NotePanelContent } from "./note-panel/NotePanelContent"
import { NotePanelActions } from "./note-panel/NotePanelActions"
import { NotePanelReplies } from "./note-panel/NotePanelReplies"

export const UnifiedNotePanel: React.FC = () => {
  const context = useNoteContext()
  const {
    note,
    readOnly,
    isNewNote,
    hideGenerateTags,
    onUpdateSharing,
    onDeleteNote,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onGenerateTags,
    onCancelNewNote,
    onStickNewNote,
    onReplyFormToggle,
    onEditStateChange,
    onNoteUpdate,
    onNoteInteraction,
    onAddReply,
    onEditReply,
    onDeleteReply,
    currentUserId,
    onOpenFullscreen,
  } = context

  const {
    showReplyForm,
    setShowReplyForm,
    replyContent,
    setReplyContent,
    replyColor,
    isSubmittingReply,
    setIsSubmittingReply,
    setActiveTab,
    resetKey,
    isEditing,
    setIsEditing,
    handleTopicChangeInternal,
    handleContentChangeInternal,
    handleDetailsChangeInternal,
    initializeEditingState, // Declared here
    handleStartEditing, // Declared here
    replyCount, // Declared here
  } = useNote(note, {
    isNewNote,
    readOnly,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onNoteUpdate,
    onNoteInteraction,
  })

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

  // Reply handlers - replies are the only editable thing in panel mode
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
      // Removed unused resetReplyForm variable
      onReplyFormToggle?.(note.id, false)
    },
    [note.id, onReplyFormToggle],
  )

  const handleStickReply = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const trimmedContent = replyContent.trim()
      if (!trimmedContent || isSubmittingReply) return

      setIsSubmittingReply(true)
      try {
        await onAddReply(note.id, trimmedContent, replyColor)
        // Removed unused resetReplyForm variable
        onReplyFormToggle?.(note.id, false)
      } catch (error) {
        console.error("Error submitting reply:", error)
      } finally {
        setIsSubmittingReply(false)
      }
    },
    [replyContent, isSubmittingReply, onAddReply, note.id, replyColor, onReplyFormToggle, setIsSubmittingReply],
  )

  // Mouse event handlers (simplified for panel mode)
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

  const renderMetadata = useCallback(() => {
    return (
      <>
        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mb-3 mt-3">
            <div className="flex flex-wrap gap-1">
              {note.tags.map((tag, index) => (
                <Badge key={`${note.id}-tag-${tag}-${index}`} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Hyperlinks */}
        {note.hyperlinks && note.hyperlinks.length > 0 && (
          <div className="mb-3 mt-3">
            <div className="flex flex-wrap gap-1">
              {note.hyperlinks.map((link, idx) => {
                const linkUrl = typeof link === "string" ? link : typeof link?.url === "string" ? link.url : ""

                let linkTitle = ""
                if (typeof link === "string") {
                  linkTitle = link
                } else if (link && typeof link === "object") {
                  if (typeof link.title === "string") {
                    linkTitle = link.title
                  } else if (typeof link.url === "string") {
                    linkTitle = link.url
                  } else {
                    linkTitle = String(link.title || link.url || "Link")
                  }
                }

                if (!linkUrl && !linkTitle) return null

                return (
                  <a
                    key={`${note.id}-link-${idx}`} // Use unique key combining note ID and index instead of URL
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600 hover:text-blue-800 text-xs px-2 py-1 bg-blue-50 rounded"
                    title={linkTitle}
                  >
                    {linkTitle}
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Generate Tags Button - disabled in panel mode */}
        {!isNewNote && !hideGenerateTags && (
          <div className="flex items-center gap-2 mt-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGenerateTags(note.id, note.topic || note.title || "")}
              disabled={true} // Disabled in panel mode
              className="text-xs h-6 opacity-50"
            >
              Generate Links
            </Button>
          </div>
        )}
      </>
    )
  }, [note.tags, note.hyperlinks, isNewNote, hideGenerateTags, note.id, note.topic, note.title, onGenerateTags])

  return (
    <Card className="relative" data-note-id={note.id} onClick={handleCardClick}>
      <CardContent className="p-4 text-gray-900 relative">
        {!isNewNote && <NotePanelHeader note={note} onUpdateSharing={onUpdateSharing} onDeleteNote={onDeleteNote} />}

        <NotePanelContent
          note={note}
          resetKey={resetKey}
          onTopicChange={handleTopicChangeInternal}
          onContentChange={handleContentChangeInternal}
          onDetailsChange={handleDetailsChangeInternal}
          onStartEditing={handleStartEditing}
          onNoteInteraction={onNoteInteraction}
          onTabChange={setActiveTab}
          isNewNote={isNewNote}
          isEditing={isEditing}
          readOnly={readOnly}
        />

        <NotePanelActions
          note={note}
          isNewNote={isNewNote}
          onCancelNewNote={onCancelNewNote}
          onStickNewNote={onStickNewNote}
          onEditingChange={setIsEditing}
        />

        {renderMetadata()}

        <NotePanelReplies
          note={note}
          isNewNote={isNewNote}
          replyCount={replyCount}
          showReplyForm={showReplyForm}
          replyContent={replyContent}
          isSubmittingReply={isSubmittingReply}
          setIsSubmittingReply={setIsSubmittingReply}
          onOpenFullscreen={onOpenFullscreen}
          onAddReplyClick={handleAddReplyClick}
          onCancelReply={handleCancelReply}
          onStickReply={handleStickReply}
          onAddReply={onAddReply}
          onEditReply={onEditReply}
          onDeleteReply={onDeleteReply}
          currentUserId={currentUserId}
          onReplyContentChange={setReplyContent}
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

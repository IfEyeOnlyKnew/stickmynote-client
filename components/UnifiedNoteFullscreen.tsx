"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import React from "react"
import { useEffect, useCallback, useMemo } from "react"
import { useNoteContext } from "./NoteContext"
import { useNote } from "@/hooks/useNote"
import { NoteFullscreenHeader } from "./note-fullscreen/NoteFullscreenHeader"
import { NoteFullscreenContent } from "./note-fullscreen/NoteFullscreenContent"
import { NoteFullscreenReplies } from "./note-fullscreen/NoteFullscreenReplies"
import { SummarizeLinksButton } from "./ui/summarize-links-button"
import { Trash2, Share2, Lock, MessagesSquare, Video, Sparkles } from "lucide-react"
import { useState } from "react"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import { AskAIModal } from "@/components/ai/AskAIModal"

export const UnifiedNoteFullscreen: React.FC = () => {
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [askAIOpen, setAskAIOpen] = useState(false)
  const context = useNoteContext()
  const {
    note,
    readOnly,
    isNewNote,
    isOwner,
    generatingTags,
    summarizingLinks,
    hideGenerateTags,
    onClose,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onGenerateTags,
    onSummarizeLinks,
    onCancelNewNote,
    onStickNewNote,
    onEditStateChange,
    onNoteUpdate,
    onNoteInteraction,
    onAddReply,
    onEditReply,
    onDeleteReply,
    currentUserId,
    onUpdateSharing,
    onDeleteNote,
  } = context

  const {
    replyContent,
    setReplyContent,
    isSubmittingReply,
    setIsSubmittingReply,
    resetKey,
    isGeneratingSummary,
    setIsGeneratingSummary,
    replySummary,
    setReplySummary,
    selectedTone,
    setSelectedTone,
    isEditing,
    editedTopic,
    editedContent,
    isSaving,
    replies,
    replyCount,
    tones,
    handleStartEditing,
    handleCancelEdit,
    handleStickEdit,
    handleTopicChangeInternal,
    handleContentChangeInternal,
    handleDetailsChangeInternal,
    setIsEditing,
  } = useNote(note, {
    isNewNote,
    readOnly,
    onTopicChange,
    onContentChange,
    onDetailsChange,
    onNoteUpdate,
    onNoteInteraction,
  })

  useEffect(() => {
    onEditStateChange?.(note.id, isEditing)
  }, [isEditing, note.id, onEditStateChange])

  // Check if a link summary report has been generated
  // The report is stored in the details field and contains "LINK SUMMARY REPORT" marker
  const hasLinkSummaryReport = useMemo(() => {
    if (!note.details) return false
    return note.details.includes("LINK SUMMARY REPORT") || note.details.includes("Link Summary Report")
  }, [note.details])

  const handleSharingToggle = useCallback(() => {
    if (onUpdateSharing) {
      onUpdateSharing(note.id, !note.is_shared)
    }
  }, [note.id, note.is_shared, onUpdateSharing])

  const handleDelete = useCallback(() => {
    if (globalThis.confirm("Are you sure you want to delete this note?")) {
      if (onDeleteNote) {
        onDeleteNote(note.id)
      }
      onClose?.()
    }
  }, [note.id, onDeleteNote, onClose])

  const handleGenerateSummary = useCallback(async (tone: string) => {
    if (replies.length === 0 || isGeneratingSummary) return

    setIsGeneratingSummary(true)
    setSelectedTone(tone)

    try {
      const response = await fetch("/api/summarize-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: note.id,
          tone,
          generateDocx: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setReplySummary(data.summary || "Summary generated successfully.")

        // Refresh note tabs to show the new export in Details tab
        if (typeof globalThis.window !== "undefined") {
          globalThis.dispatchEvent(new CustomEvent("refreshNoteTabs"))
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        setReplySummary(`Failed to generate summary: ${errorData.error || "Please try again."}`)
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      setReplySummary("Failed to generate summary. Please try again.")
    } finally {
      setIsGeneratingSummary(false)
    }
  }, [note.id, replies.length, isGeneratingSummary, setIsGeneratingSummary, setSelectedTone, setReplySummary])

  const renderMetadata = useCallback(() => {
    return (
      <>
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

        {note.hyperlinks && note.hyperlinks.length > 0 && (
          <div className="mb-3 mt-3">
            <div className="flex flex-wrap gap-1">
              {note.hyperlinks.map((link, idx) => {
                let linkUrl = ""
                if (typeof link === "string") linkUrl = link
                else if (typeof link?.url === "string") linkUrl = link.url

                let linkTitle = ""
                if (typeof link === "string") {
                  linkTitle = link
                } else if (link && typeof link === "object") {
                  if (typeof link.title === "string") {
                    linkTitle = link.title
                  } else if (typeof link.url === "string") {
                    linkTitle = link.url
                  } else {
                    linkTitle = String(link.title ?? link.url ?? "Link")
                  }
                }

                if (!linkUrl && !linkTitle) return null

                return (
                  <a
                    key={`${note.id}-link-${idx}`}
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

        {!isNewNote && !hideGenerateTags && (
          <div className="flex items-center gap-2 mt-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGenerateTags(note.id, note.topic || note.title || "")}
              disabled={generatingTags === note.id}
              className="text-xs h-6"
            >
              {generatingTags === note.id ? (
                <>
                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  Generating...
                </>
              ) : (
                "Generate Links"
              )}
            </Button>

            {/* Show Summarize Links button only if there are links and no report has been generated */}
            {note.hyperlinks && note.hyperlinks.length > 0 && !hasLinkSummaryReport && onSummarizeLinks && (
              <SummarizeLinksButton
                onClick={() => onSummarizeLinks(note.id)}
                isSummarizing={summarizingLinks === note.id}
              />
            )}
          </div>
        )}
      </>
    )
  }, [
    note.tags,
    note.hyperlinks,
    note.id,
    note.topic,
    note.title,
    isNewNote,
    hideGenerateTags,
    generatingTags,
    summarizingLinks,
    hasLinkSummaryReport,
    onGenerateTags,
    onSummarizeLinks,
  ])

  // Render as content-only (no modal overlay) - parent container handles the modal
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Left Panel: Note Content */}
        <div className="rounded-lg shadow-md border bg-white flex flex-col max-h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 bg-white/80 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <NoteFullscreenHeader onClose={onClose} />
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              {/* Ask AI Button */}
              {!isNewNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAskAIOpen(true)}
                  className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-1"
                  title="Ask AI a question about this stick"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-medium hidden sm:inline">Ask AI</span>
                </Button>
              )}

              {/* Chat Icon */}
              {!isNewNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChatModalOpen(true)}
                  className="h-7 w-7 p-0"
                  title="Start chat"
                >
                  <MessagesSquare className="h-4 w-4 text-purple-500" />
                </Button>
              )}

              {/* Video Icon */}
              {!isNewNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open("/video", "_blank")}
                  className="h-7 w-7 p-0"
                  title="Start video call"
                >
                  <Video className="h-4 w-4 text-blue-500" />
                </Button>
              )}

              {!isNewNote && isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSharingToggle}
                  className="flex items-center gap-1 bg-transparent text-xs md:text-sm px-2 md:px-3"
                  title={note.is_shared ? "Make Personal" : "Make Shared"}
                >
                  {note.is_shared ? (
                    <>
                      <Share2 className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">Shared</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">Personal</span>
                    </>
                  )}
                </Button>
              )}

              {!isNewNote && isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent px-2 md:px-3"
                  title="Delete Note"
                >
                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="p-3 md:p-4 lg:p-6 bg-transparent text-gray-900 flex-1 overflow-y-auto">
            <NoteFullscreenContent
              noteId={note.id}
              topic={editedTopic}
              content={editedContent}
              onTopicChange={handleTopicChangeInternal}
              onContentChange={handleContentChangeInternal}
              onDetailsChange={handleDetailsChangeInternal}
              onTopicFocus={() => !isNewNote && !isEditing && !readOnly && handleStartEditing()}
              onContentFocus={() => !isNewNote && !isEditing && !readOnly && handleStartEditing()}
              readOnly={readOnly || (!isOwner && !isNewNote)}
              resetKey={resetKey}
              onNoteInteraction={onNoteInteraction}
              onTabChange={() => {}}
              isEditing={isEditing}
              isNewNote={isNewNote}
              onCancel={isNewNote ? () => onCancelNewNote?.(note.id) : handleCancelEdit}
              onStick={
                isNewNote
                  ? () => {
                      onStickNewNote?.(note.id)
                      setIsEditing(false)
                    }
                  : handleStickEdit
              }
              isSaving={isSaving}
            />
            {renderMetadata()}
          </div>
        </div>

        {/* Right Panel: Replies */}
        <div className="max-h-[calc(100vh-8rem)]">
          <NoteFullscreenReplies
            noteId={note.id}
            replies={replies}
            replyCount={replyCount}
            replyContent={replyContent}
            setReplyContent={setReplyContent}
            isSubmittingReply={isSubmittingReply}
            setIsSubmittingReply={setIsSubmittingReply}
            isGeneratingSummary={isGeneratingSummary}
            setIsGeneratingSummary={setIsGeneratingSummary}
            replySummary={replySummary}
            setReplySummary={setReplySummary}
            selectedTone={selectedTone}
            setSelectedTone={setSelectedTone}
            tones={tones}
            onAddReply={onAddReply}
            onEditReply={onEditReply}
            onDeleteReply={onDeleteReply}
            onGenerateSummary={handleGenerateSummary}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={note.topic || note.title || "Untitled Note"}
        autoSubmit
      />

      {/* Ask AI Modal */}
      <AskAIModal
        open={askAIOpen}
        onOpenChange={setAskAIOpen}
        stickId={note.id}
        stickType="personal"
      />
    </div>
  )
}

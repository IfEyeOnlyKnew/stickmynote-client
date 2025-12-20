"use client"

import { UnifiedReplies } from "@/components/shared/UnifiedReplies"
import type React from "react"
import type { Note } from "@/types/note"

interface NotePanelRepliesProps {
  note: Note
  isNewNote: boolean
  replyCount: number
  showReplyForm: boolean
  replyContent: string
  isSubmittingReply: boolean
  onOpenFullscreen?: (noteId: string) => void
  onAddReplyClick: (e: React.MouseEvent) => void
  onCancelReply: (e: React.MouseEvent) => void
  onStickReply: (e: React.MouseEvent) => void
  onReplyContentChange: (content: string) => void
  setIsSubmittingReply?: (submitting: boolean) => void
}

export const NotePanelReplies: React.FC<NotePanelRepliesProps> = ({ note, onReplyContentChange, ...props }) => {
  return (
    <UnifiedReplies
      {...props}
      noteId={note.id}
      context="panel"
      replies={note.replies || []}
      setReplyContent={onReplyContentChange}
      enableFullscreenButton={true}
    />
  )
}

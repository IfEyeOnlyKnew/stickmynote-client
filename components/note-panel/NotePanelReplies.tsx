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
  onAddReply?: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  currentUserId?: string
}

export const NotePanelReplies: React.FC<NotePanelRepliesProps> = ({ 
  note, 
  onReplyContentChange, 
  onAddReply,
  onEditReply,
  onDeleteReply,
  currentUserId,
  ...props 
}) => {
  return (
    <UnifiedReplies
      {...props}
      noteId={note.id}
      context="panel"
      replies={note.replies || []}
      setReplyContent={onReplyContentChange}
      enableFullscreenButton={true}
      enableReplyToReply={true}
      canEdit={!props.isNewNote}
      onAddReply={onAddReply}
      onEditReply={onEditReply}
      onDeleteReply={onDeleteReply}
      currentUserId={currentUserId}
    />
  )
}

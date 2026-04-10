"use client"

import { UnifiedReplies } from "@/components/shared/UnifiedReplies"
import type React from "react"
import type { Note } from "@/types/note"

interface NotePanelRepliesProps {
  readonly note: Note
  readonly isNewNote: boolean
  readonly replyCount: number
  readonly showReplyForm: boolean
  readonly replyContent: string
  readonly isSubmittingReply: boolean
  readonly onOpenFullscreen?: (noteId: string) => void
  readonly onAddReplyClick: (e: React.MouseEvent) => void
  readonly onCancelReply: (e: React.MouseEvent) => void
  readonly onStickReply: (e: React.MouseEvent) => void
  readonly onReplyContentChange: (content: string) => void
  readonly setIsSubmittingReply?: (submitting: boolean) => void
  readonly onAddReply?: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  readonly onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  readonly onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  readonly currentUserId?: string
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

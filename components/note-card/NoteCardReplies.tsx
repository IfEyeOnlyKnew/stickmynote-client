"use client"

import { UnifiedReplies } from "@/components/shared/UnifiedReplies"
import type React from "react"

interface NoteCardRepliesProps {
  noteId: string
  isNewNote: boolean
  replyCount: number
  showReplyForm: boolean
  replyContent: string
  isSubmittingReply: boolean
  onOpenFullscreen?: (noteId: string) => void
  onAddReplyClick: (e: React.MouseEvent) => void
  onCancelReply: (e: React.MouseEvent) => void
  onStickReply: (e: React.MouseEvent) => void
  setReplyContent: (content: string) => void
  setIsSubmittingReply?: (submitting: boolean) => void
}

export const NoteCardReplies: React.FC<NoteCardRepliesProps> = (props) => {
  return <UnifiedReplies {...props} context="card" replies={[]} enableFullscreenButton={true} />
}

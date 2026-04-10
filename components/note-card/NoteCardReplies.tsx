"use client"

import { UnifiedReplies } from "@/components/shared/UnifiedReplies"
import type React from "react"

interface NoteCardRepliesProps {
  readonly noteId: string
  readonly isNewNote: boolean
  readonly replyCount: number
  readonly showReplyForm: boolean
  readonly replyContent: string
  readonly isSubmittingReply: boolean
  readonly onOpenFullscreen?: (noteId: string) => void
  readonly onAddReplyClick: (e: React.MouseEvent) => void
  readonly onCancelReply: (e: React.MouseEvent) => void
  readonly onStickReply: (e: React.MouseEvent) => void
  readonly setReplyContent: (content: string) => void
  readonly setIsSubmittingReply?: (submitting: boolean) => void
}

export const NoteCardReplies: React.FC<NoteCardRepliesProps> = (props) => {
  return <UnifiedReplies {...props} context="card" replies={[]} enableFullscreenButton={true} />
}

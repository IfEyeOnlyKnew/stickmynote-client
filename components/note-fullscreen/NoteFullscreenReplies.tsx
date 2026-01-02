"use client"

import { UnifiedReplies } from "@/components/shared/UnifiedReplies"
import type React from "react"

interface Reply {
  id: string
  content: string
  color?: string
  created_at: string
  updated_at?: string
  user_id?: string
  user?: {
    username?: string
    email?: string
  }
}

interface Tone {
  value: string
  label: string
}

interface NoteFullscreenRepliesProps {
  noteId: string
  replies: Reply[]
  replyCount: number
  replyContent: string
  setReplyContent: (content: string) => void
  isSubmittingReply: boolean
  setIsSubmittingReply: (submitting: boolean) => void
  isGeneratingSummary: boolean
  setIsGeneratingSummary: (generating: boolean) => void
  replySummary: string | null
  setReplySummary: (summary: string) => void
  selectedTone: string
  setSelectedTone: (tone: string) => void
  tones: Tone[]
  onAddReply: (noteId: string, content: string) => Promise<void>
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  currentUserId?: string | null
}

export const NoteFullscreenReplies: React.FC<NoteFullscreenRepliesProps> = (props) => {
  const { noteId, onEditReply, onDeleteReply, currentUserId, ...restProps } = props

  return (
    <UnifiedReplies
      {...restProps}
      noteId={noteId}
      context="fullscreen"
      enableSummary={true}
      onEditReply={onEditReply}
      onDeleteReply={onDeleteReply}
      currentUserId={currentUserId}
    />
  )
}

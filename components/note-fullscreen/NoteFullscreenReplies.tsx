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
  onAddReply: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  currentUserId?: string | null
  // Real-time polling for chat-like experience
  enablePolling?: boolean
  onRepliesUpdated?: (replies: Reply[]) => void
  // Allow editing/replying (defaults to true)
  canEdit?: boolean
}

export const NoteFullscreenReplies: React.FC<NoteFullscreenRepliesProps> = (props) => {
  const { noteId, onEditReply, onDeleteReply, currentUserId, enablePolling = true, onRepliesUpdated, onAddReply, canEdit, ...restProps } = props

  console.log("[NoteFullscreenReplies] onAddReply:", typeof onAddReply)
  console.log("[NoteFullscreenReplies] canEdit:", canEdit)

  return (
    <UnifiedReplies
      {...restProps}
      noteId={noteId}
      context="fullscreen"
      enableSummary={true}
      onAddReply={onAddReply}
      onEditReply={onEditReply}
      onDeleteReply={onDeleteReply}
      currentUserId={currentUserId}
      enablePolling={enablePolling}
      onRepliesUpdated={onRepliesUpdated}
      canEdit={canEdit}
    />
  )
}

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
  readonly noteId: string
  readonly replies: Reply[]
  readonly replyCount: number
  readonly replyContent: string
  readonly setReplyContent: (content: string) => void
  readonly isSubmittingReply: boolean
  readonly setIsSubmittingReply: (submitting: boolean) => void
  readonly isGeneratingSummary: boolean
  readonly setIsGeneratingSummary: (generating: boolean) => void
  readonly replySummary: string | null
  readonly setReplySummary: (summary: string) => void
  readonly selectedTone: string
  readonly setSelectedTone: (tone: string) => void
  readonly tones: Tone[]
  readonly onAddReply: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  readonly onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
  readonly onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  readonly onGenerateSummary?: (tone: string) => void
  readonly currentUserId?: string | null
  // Real-time polling for chat-like experience
  readonly enablePolling?: boolean
  readonly onRepliesUpdated?: (replies: Reply[]) => void
  // Allow editing/replying (defaults to true)
  readonly canEdit?: boolean
}

export const NoteFullscreenReplies: React.FC<NoteFullscreenRepliesProps> = (props) => {
  const { noteId, onEditReply, onDeleteReply, onGenerateSummary, currentUserId, enablePolling = true, onRepliesUpdated, onAddReply, canEdit, ...restProps } = props

  return (
    <UnifiedReplies
      {...restProps}
      noteId={noteId}
      context="fullscreen"
      enableSummary={true}
      onAddReply={onAddReply}
      onEditReply={onEditReply}
      onDeleteReply={onDeleteReply}
      onGenerateSummary={onGenerateSummary}
      currentUserId={currentUserId}
      enablePolling={enablePolling}
      onRepliesUpdated={onRepliesUpdated}
      canEdit={canEdit}
    />
  )
}

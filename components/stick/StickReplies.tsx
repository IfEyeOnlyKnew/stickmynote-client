"use client"

import { ThreadedReplies } from "@/components/replies/ThreadedReplies"
import type { ThreadedReply } from "@/components/replies/ThreadedReplyItem"

interface Reply {
  id: string
  content: string
  color?: string
  created_at: string
  updated_at?: string
  user?: {
    username?: string
    email?: string
  }
  parent_reply_id?: string | null
}

interface Tone {
  value: string
  label: string
}

interface StickRepliesProps {
  replies: Reply[]
  newReply: string
  replyCount: number
  replySummary: string | null
  isGeneratingSummary: boolean
  isExporting: boolean
  isSubmittingReply: boolean
  canEdit: boolean
  isNew: boolean
  tones: Tone[]
  onNewReplyChange: (value: string) => void
  onSubmitReply: () => void
  onGenerateSummary: (tone: string) => void
  onGenerateSummaryDocx: (tone: string) => void
  onExportAll: () => void
  onSetSelectedTone: (tone: string) => void
  setIsSubmittingReply?: (submitting: boolean) => void
  currentUserId?: string | null
}

export function StickReplies({
  newReply,
  onNewReplyChange,
  onSubmitReply,
  onSetSelectedTone,
  isNew,
  currentUserId,
  ...props
}: StickRepliesProps) {
  return (
    <ThreadedReplies
      {...props}
      noteId="" // Sticks handle this differently
      context="stick"
      replyContent={newReply}
      setReplyContent={onNewReplyChange}
      isNewNote={isNew}
      enableSummary={true}
      enableExport={true}
      enableThreading={true}
      onStickReply={onSubmitReply}
      setSelectedTone={onSetSelectedTone}
      currentUserId={currentUserId}
    />
  )
}

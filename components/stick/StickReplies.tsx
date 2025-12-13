"use client"

import { UnifiedReplies } from "@/components/shared/UnifiedReplies"

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
}

export function StickReplies({
  newReply,
  onNewReplyChange,
  onSubmitReply,
  onSetSelectedTone,
  isNew,
  ...props
}: StickRepliesProps) {
  return (
    <UnifiedReplies
      {...props}
      noteId="" // Sticks handle this differently
      context="stick"
      replyContent={newReply}
      setReplyContent={onNewReplyChange}
      isNewNote={isNew}
      enableSummary={true}
      enableExport={true}
      onStickReply={onSubmitReply}
      setSelectedTone={onSetSelectedTone}
    />
  )
}

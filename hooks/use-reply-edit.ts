import { useState, useCallback } from "react"

/**
 * Shared edit state and handlers for reply items.
 * Used by both ThreadedReplyItem and ReplyItem to eliminate duplicate edit logic.
 */
export function useReplyEdit(
  replyId: string,
  initialContent: string,
  onEdit?: (replyId: string, content: string) => Promise<void>,
) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(initialContent)
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = useCallback(() => {
    setEditContent(initialContent)
    setIsEditing(true)
  }, [initialContent])

  const handleCancelEdit = useCallback(() => {
    setEditContent(initialContent)
    setIsEditing(false)
  }, [initialContent])

  const handleSaveEdit = useCallback(async () => {
    if (!onEdit || !editContent.trim() || editContent.trim() === initialContent) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onEdit(replyId, editContent.trim())
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving reply edit:", error)
    } finally {
      setIsSaving(false)
    }
  }, [onEdit, editContent, initialContent, replyId])

  return { isEditing, editContent, setEditContent, isSaving, handleStartEdit, handleCancelEdit, handleSaveEdit }
}

/**
 * Shared inline reply state and handlers.
 * Used by both ThreadedReplyItem and ReplyItem.
 */
export function useInlineReply(
  replyId: string,
  onSubmit?: (content: string, parentReplyId: string) => Promise<void>,
  onFallbackReply?: (reply: any) => void,
  reply?: any,
) {
  const [isReplying, setIsReplying] = useState(false)
  const [inlineReplyContent, setInlineReplyContent] = useState("")
  const [isSubmittingInlineReply, setIsSubmittingInlineReply] = useState(false)

  const handleReply = useCallback(() => {
    if (onSubmit) {
      setIsReplying(true)
    } else if (onFallbackReply && reply) {
      onFallbackReply(reply)
    }
  }, [onSubmit, onFallbackReply, reply])

  const handleCancelInlineReply = useCallback(() => {
    setIsReplying(false)
    setInlineReplyContent("")
  }, [])

  const handleSubmitInlineReply = useCallback(async () => {
    if (!onSubmit || !inlineReplyContent.trim() || isSubmittingInlineReply) return

    setIsSubmittingInlineReply(true)
    try {
      await onSubmit(inlineReplyContent.trim(), replyId)
      setInlineReplyContent("")
      setIsReplying(false)
    } catch (error) {
      console.error("Error submitting inline reply:", error)
    } finally {
      setIsSubmittingInlineReply(false)
    }
  }, [onSubmit, inlineReplyContent, isSubmittingInlineReply, replyId])

  return {
    isReplying,
    inlineReplyContent,
    setInlineReplyContent,
    isSubmittingInlineReply,
    handleReply,
    handleCancelInlineReply,
    handleSubmitInlineReply,
  }
}

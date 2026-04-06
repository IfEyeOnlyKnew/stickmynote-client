"use client"

import { useState, memo, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Pencil, Trash2, MessageSquare, CheckSquare, AlertCircle, RefreshCw, ChevronDown, ChevronRight, CornerDownRight, Send, X, Check } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DEPTH_COLORS } from "@/components/replies/reply-shared"

// Maximum nesting depth before showing message
export const MAX_REPLY_DEPTH = 5

interface Reply {
  id: string
  content: string
  color: string
  category: string
  created_at: string
  updated_at: string
  user_id: string
  parent_reply_id: string | null
  calstick_id?: string | null
  users: {
    id: string
    full_name: string | null
    username: string | null
    email: string
    avatar_url: string | null
  }
  replies?: Reply[]
}

interface CalStickInfo {
  id: string
  content: string
  updated_at: string
}

interface ReplyCardProps {
  reply: Reply
  depth?: number
  currentUserId?: string
  isPadOwner: boolean
  isAdmin: boolean
  parentAuthor?: string
  onEdit: (replyId: string, content: string) => Promise<void>
  onDelete: (replyId: string) => void
  onReply: (reply: Reply) => void
  onSubmitReply?: (content: string, parentReplyId: string) => Promise<void>
  onSyncFromCalStick?: (replyId: string, calstickId: string) => Promise<void>
  renderNestedReply: (reply: Reply, depth: number, parentAuthor?: string) => React.ReactNode
}

export const ReplyCard = memo(function ReplyCard({
  reply,
  depth = 0,
  currentUserId,
  isPadOwner,
  isAdmin,
  parentAuthor,
  onEdit,
  onDelete,
  onReply,
  onSubmitReply,
  onSyncFromCalStick,
  renderNestedReply,
}: ReplyCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [calstickInfo, setCalstickInfo] = useState<CalStickInfo | null>(null)
  const [isCheckingSync, setIsCheckingSync] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hasCalstickChanges, setHasCalstickChanges] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Inline reply state
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isOwner = reply.user_id === currentUserId
  const canDelete = isOwner || isPadOwner || isAdmin
  const canEdit = isOwner
  const hasReplies = reply.replies && reply.replies.length > 0
  const replyCount = reply.replies?.length || 0
  const wasEdited = reply.updated_at !== reply.created_at

  // Get depth-based styling
  const depthColors = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const nextDepthColors = DEPTH_COLORS[(depth + 1) % DEPTH_COLORS.length]
  // Reduce indentation for deeper nesting to prevent overflow (16px per level, max 80px)
  const indentPx = Math.min(depth * 16, 80)
  // Calculate thread line position based on reduced indentation
  const threadLineLeft = depth > 0 ? Math.min((depth - 1) * 16, 64) + 6 : 0

  // Focus textarea when opening reply form
  useEffect(() => {
    if (isReplying && replyTextareaRef.current) {
      replyTextareaRef.current.focus()
    }
  }, [isReplying])

  // Check if CalStick content differs from reply content
  useEffect(() => {
    if (!reply.calstick_id) {
      setCalstickInfo(null)
      setHasCalstickChanges(false)
      return
    }

    const checkCalstickSync = async () => {
      setIsCheckingSync(true)
      try {
        const response = await fetch(`/api/calsticks/${reply.calstick_id}`)
        if (response.ok) {
          const data = await response.json()
          const calstick = data.calstick
          setCalstickInfo({
            id: calstick.id,
            content: calstick.content,
            updated_at: calstick.updated_at,
          })
          // Check if content differs
          setHasCalstickChanges(calstick.content !== reply.content)
        }
      } catch (error) {
        console.error("Error checking CalStick sync:", error)
      } finally {
        setIsCheckingSync(false)
      }
    }

    checkCalstickSync()
  }, [reply.calstick_id, reply.content])

  const handleSyncFromCalStick = useCallback(async () => {
    if (!reply.calstick_id || !calstickInfo || !onSyncFromCalStick) return

    setIsSyncing(true)
    try {
      await onSyncFromCalStick(reply.id, reply.calstick_id)
      setHasCalstickChanges(false)
    } catch (error) {
      console.error("Error syncing from CalStick:", error)
    } finally {
      setIsSyncing(false)
    }
  }, [reply.id, reply.calstick_id, calstickInfo, onSyncFromCalStick])

  const getDisplayName = useCallback((r: Reply) => {
    if (!r.users) return "Unknown User"
    return r.users.full_name || r.users.username || r.users.email
  }, [])

  const getInitials = useCallback((r: Reply) => {
    if (!r.users) return "??"
    const name = r.users.full_name || r.users.username || r.users.email
    return name.substring(0, 2).toUpperCase()
  }, [])

  const handleStartEdit = useCallback(() => {
    setEditContent(reply.content)
    setIsEditing(true)
  }, [reply.content])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditContent("")
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim() || editContent.trim() === reply.content) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onEdit(reply.id, editContent.trim())
      setIsEditing(false)
      setEditContent("")
    } catch (error) {
      console.error("Error saving reply:", error)
    } finally {
      setIsSaving(false)
    }
  }, [editContent, reply.id, reply.content, onEdit])

  const handleReplyClick = useCallback(() => {
    if (onSubmitReply) {
      // Use inline reply form
      setIsReplying(true)
      setReplyContent("")
    } else if (onReply) {
      // Fallback to old behavior (scroll to main reply form)
      onReply(reply)
    }
  }, [onSubmitReply, onReply, reply])

  const handleCancelReply = useCallback(() => {
    setIsReplying(false)
    setReplyContent("")
  }, [])

  const handleSubmitInlineReply = useCallback(async () => {
    if (!onSubmitReply || !replyContent.trim() || isSubmittingReply) return

    setIsSubmittingReply(true)
    try {
      await onSubmitReply(replyContent.trim(), reply.id)
      setReplyContent("")
      setIsReplying(false)
    } catch (error) {
      console.error("Error submitting reply:", error)
    } finally {
      setIsSubmittingReply(false)
    }
  }, [onSubmitReply, replyContent, isSubmittingReply, reply.id])

  return (
    <li className="list-none relative overflow-hidden">
      {/* Thread line for nested replies */}
      {depth > 0 && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-0.5 ${depthColors.line}`}
          style={{ marginLeft: `${threadLineLeft}px` }}
        />
      )}

      <div
        className="relative min-w-0"
        style={{ marginLeft: `${indentPx}px` }}
      >
        {/* Horizontal connector line */}
        {depth > 0 && (
          <div
            className={`absolute left-0 top-5 w-3 h-0.5 ${depthColors.line}`}
            style={{ marginLeft: "-12px" }}
          />
        )}

        <div
          className={`rounded-lg p-3 border border-l-4 group transition-colors ${
            depth > 0 ? depthColors.bg : "bg-gray-50"
          }`}
          style={{
            borderLeftColor: depth === 0 ? (reply.color || "#d1d5db") : undefined,
          }}
        >
          <div className="space-y-2">
            {/* Header with user info, timestamp, and actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {reply.users?.avatar_url && (
                    <AvatarImage src={reply.users.avatar_url} alt={getDisplayName(reply)} />
                  )}
                  <AvatarFallback className="text-xs bg-gray-200">{getInitials(reply)}</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-medium text-gray-900">{getDisplayName(reply)}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500">
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                  </span>
                  {wasEdited && <span className="text-gray-400">(edited)</span>}
                  <span className="text-gray-400 text-[10px]" title={`Reply ID: ${reply.id}`}>
                    #{reply.id.substring(0, 8)}
                  </span>
                  {reply.category && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {reply.category}
                    </Badge>
                  )}
                  {reply.calstick_id && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 flex items-center gap-1 ${
                              hasCalstickChanges
                                ? "border-amber-400 bg-amber-50 text-amber-700"
                                : "border-purple-400 bg-purple-50 text-purple-700"
                            }`}
                          >
                            {isCheckingSync && (
                              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                            )}
                            {!isCheckingSync && hasCalstickChanges && (
                              <AlertCircle className="h-2.5 w-2.5" />
                            )}
                            {!isCheckingSync && !hasCalstickChanges && (
                              <CheckSquare className="h-2.5 w-2.5" />
                            )}
                            CalStick
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasCalstickChanges
                            ? "CalStick content has changed. Click sync to update."
                            : "This reply is linked to a CalStick task"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasCalstickChanges && onSyncFromCalStick && !isEditing && !isReplying && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={handleSyncFromCalStick}
                          disabled={isSyncing}
                          title="Sync from CalStick"
                        >
                          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Update reply with CalStick changes
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!isEditing && !isReplying && depth < MAX_REPLY_DEPTH && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReplyClick}
                    className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                    title="Reply to this"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                )}
                {canEdit && !isEditing && !isReplying && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEdit}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit reply"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {canDelete && !isEditing && !isReplying && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(reply.id)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete reply"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Replying to indicator */}
            {parentAuthor && depth > 0 && (
              <div className={`flex items-center gap-1 text-xs ${depthColors.text}`}>
                <CornerDownRight className="h-3 w-3" />
                <span>Replying to @{parentAuthor}</span>
              </div>
            )}

            {/* Reply content */}
            {isEditing ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-sm text-gray-900 min-h-[60px] resize-none"
                  maxLength={1000}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{editContent.length}/1000</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="h-6 px-2 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editContent.trim()}
                      className="h-6 px-2 text-xs"
                    >
                      {isSaving ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{reply.content}</div>
            )}

            {/* Collapse/expand button for nested replies */}
            {hasReplies && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`flex items-center gap-1 text-xs ${depthColors.text} hover:underline mt-2`}
              >
                {isCollapsed ? (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    Show {replyCount} {replyCount === 1 ? "reply" : "replies"}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Hide {replyCount} {replyCount === 1 ? "reply" : "replies"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* INLINE REPLY FORM - appears directly below this reply */}
        {isReplying && onSubmitReply && (
          <div
            className={`mt-2 p-3 rounded-lg border-2 border-dashed ${nextDepthColors.line} ${nextDepthColors.bg}`}
            style={{ marginLeft: "16px" }}
          >
            <div className={`flex items-center gap-1 text-xs ${nextDepthColors.text} mb-2`}>
              <CornerDownRight className="h-3 w-3" />
              <span>Replying to @{getDisplayName(reply)}</span>
              <span className="text-gray-400">→ parent: #{reply.id.substring(0, 8)}</span>
            </div>
            <Textarea
              ref={replyTextareaRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Reply to ${getDisplayName(reply)}...`}
              className="text-sm text-gray-900 min-h-[60px] resize-none mb-2"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{replyContent.length}/1000</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelReply}
                  disabled={isSubmittingReply}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSubmitInlineReply}
                  disabled={isSubmittingReply || !replyContent.trim()}
                  className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmittingReply ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {hasReplies && !isCollapsed && (
          <ul className="mt-2 space-y-2">
            {reply.replies!.map((nestedReply) => renderNestedReply(nestedReply, depth + 1, getDisplayName(reply)))}
          </ul>
        )}
      </div>
    </li>
  )
})

"use client"

import { useState, useRef, useEffect } from "react"
import { Trash2, Pencil, Check, X, MessageSquare, ChevronDown, ChevronRight, CornerDownRight, Send, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getTimestampDisplay } from "@/utils/noteUtils"
import { CalStickControls } from "./CalStickControls"
import type React from "react"

import { DEPTH_COLORS, getReplyDisplayName, getReplyInitials, type BaseReply } from "./reply-shared"

// Maximum nesting depth before showing "Start a Chat" instead of reply button
export const MAX_REPLY_DEPTH = 5

type Reply = BaseReply

interface ReplyItemProps {
  reply: Reply
  depth?: number
  context: string
  supportsCalStick: boolean
  editingCalStick: string | null
  calStickDate: string
  currentUserId?: string | null
  parentAuthor?: string
  onDelete?: (replyId: string) => void
  onEdit?: (replyId: string, content: string) => Promise<void>
  onReply?: (reply: Reply) => void
  // New: direct submit handler for inline reply
  onSubmitReply?: (content: string, parentReplyId: string) => Promise<void>
  // Start a chat when depth >= MAX_REPLY_DEPTH
  onStartChat?: (parentReply: Reply) => void
  onToggleCalStick: (replyId: string, currentIsCalStick: boolean, currentDate: string | null) => void
  onCalStickDateChange: (replyId: string, date: string) => void
  onSaveCalStickDate: (replyId: string) => void
  onCancelCalStickEdit: () => void
  onToggleCalStickComplete: (replyId: string, currentCompleted: boolean) => void
}

// --- Extracted sub-components to reduce cognitive complexity ---

function ReplyActionButtons({
  reply,
  depth,
  isEditing,
  isReplying,
  isOwner,
  onReply,
  onSubmitReply,
  onStartChat,
  onEdit,
  onDelete,
  onReplyClick,
  onStartEdit,
}: Readonly<{
  reply: Reply
  depth: number
  isEditing: boolean
  isReplying: boolean
  isOwner: boolean | "" | null | undefined
  onReply?: (reply: Reply) => void
  onSubmitReply?: (content: string, parentReplyId: string) => Promise<void>
  onStartChat?: (parentReply: Reply) => void
  onEdit?: (replyId: string, content: string) => Promise<void>
  onDelete?: (replyId: string) => void
  onReplyClick: () => void
  onStartEdit: () => void
}>) {
  const showReplyAction = (onReply || onSubmitReply || onStartChat) && !isEditing && !isReplying
  const atMaxDepth = depth >= MAX_REPLY_DEPTH && onStartChat
  const canReply = onReply || onSubmitReply

  const renderReplyButton = () => {
    if (atMaxDepth) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStartChat(reply)}
          className="h-6 px-2 text-xs text-purple-500 hover:text-purple-600 hover:bg-purple-50 flex items-center gap-1"
          title="Continue this discussion in a chat"
        >
          <MessageCircle className="h-3 w-3" />
          <span>Start Chat</span>
        </Button>
      )
    }
    if (canReply) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReplyClick}
          className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
          title="Reply to this"
        >
          <MessageSquare className="h-3 w-3" />
        </Button>
      )
    }
    return null
  }

  return (
    <div className="flex items-center gap-1">
      {showReplyAction && renderReplyButton()}
      {isOwner && !isEditing && (
        <>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStartEdit}
              className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit reply"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(reply.id)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete reply"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function InlineReplyForm({
  reply,
  depthColors,
  replyContent,
  isSubmittingReply,
  replyTextareaRef,
  displayName,
  onContentChange,
  onCancel,
  onSubmit,
}: Readonly<{
  reply: Reply
  depthColors: (typeof DEPTH_COLORS)[number]
  replyContent: string
  isSubmittingReply: boolean
  replyTextareaRef: React.RefObject<HTMLTextAreaElement>
  displayName: string
  onContentChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}>) {
  return (
    <div
      className={`mt-2 p-3 rounded-lg border-2 border-dashed ${depthColors.line} ${depthColors.bg}`}
      style={{ marginLeft: "16px" }}
    >
      <div className={`flex items-center gap-1 text-xs ${depthColors.text} mb-2`}>
        <CornerDownRight className="h-3 w-3" />
        <span>Replying to @{displayName}</span>
        <span className="text-gray-400">&rarr; parent: #{reply.id.substring(0, 8)}</span>
      </div>
      <Textarea
        ref={replyTextareaRef}
        value={replyContent}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder={`Reply to ${displayName}...`}
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
            onClick={onCancel}
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
            onClick={onSubmit}
            disabled={isSubmittingReply || !replyContent.trim()}
            className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
          >
            {isSubmittingReply ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send className="h-3 w-3 mr-1" />
                Stick
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Main component ---

export const ReplyItem: React.FC<ReplyItemProps> = ({
  reply,
  depth = 0,
  context,
  supportsCalStick,
  editingCalStick,
  calStickDate,
  currentUserId,
  parentAuthor,
  onDelete,
  onEdit,
  onReply,
  onSubmitReply,
  onStartChat,
  onToggleCalStick,
  onCalStickDateChange,
  onSaveCalStickDate,
  onCancelCalStickEdit,
  onToggleCalStickComplete,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(reply.content)
  const [isSaving, setIsSaving] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Inline reply state
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const timestamp = reply.updated_at || reply.created_at
  const displayTime = timestamp ? getTimestampDisplay(timestamp) : "Just now"
  const wasEdited = reply.updated_at && reply.updated_at !== reply.created_at

  const isOwner = currentUserId && reply.user_id && currentUserId === reply.user_id
  const hasReplies = reply.replies && reply.replies.length > 0
  const replyCount = reply.replies?.length || 0

  // Get depth-based styling
  const depthColors = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const nextDepthColors = DEPTH_COLORS[(depth + 1) % DEPTH_COLORS.length]
  // Reduce indentation for deeper nesting to prevent overflow (16px per level, max 80px)
  const indentPx = Math.min(depth * 16, 80)

  // Focus textarea when opening reply form
  useEffect(() => {
    if (isReplying && replyTextareaRef.current) {
      replyTextareaRef.current.focus()
    }
  }, [isReplying])

  const getDisplayName = (r: Reply) => getReplyDisplayName(r)

  const getInitials = (r: Reply) => getReplyInitials(r)

  const handleStartEdit = () => {
    setEditContent(reply.content)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditContent(reply.content)
    setIsEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!onEdit || !editContent.trim() || editContent.trim() === reply.content) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onEdit(reply.id, editContent.trim())
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving reply edit:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReplyClick = () => {
    if (onSubmitReply) {
      setIsReplying(true)
      setReplyContent("")
    } else if (onReply) {
      onReply(reply)
    }
  }

  const handleCancelReply = () => {
    setIsReplying(false)
    setReplyContent("")
  }

  const handleSubmitInlineReply = async () => {
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
  }

  // Calculate thread line position based on reduced indentation
  const threadLineLeft = depth > 0 ? Math.min((depth - 1) * 16, 64) + 6 : 0

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
          style={
            {
              "--reply-color": reply.color || "#d1d5db",
              borderLeftColor: depth === 0 ? (reply.color || "#d1d5db") : undefined,
            } as React.CSSProperties
          }
        >
          <div className="space-y-2">
            {/* Header with user info, timestamp, and actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-gray-200">
                    {getInitials(reply)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-gray-900">{getDisplayName(reply)}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500">{displayTime}</span>
                  {wasEdited && <span className="text-gray-400">(edited)</span>}
                  <span className="text-gray-400 text-[10px]" title={`Reply ID: ${reply.id}`}>
                    #{reply.id.substring(0, 8)}
                  </span>
                </div>
              </div>
              <ReplyActionButtons
                reply={reply}
                depth={depth}
                isEditing={isEditing}
                isReplying={isReplying}
                isOwner={isOwner}
                onReply={onReply}
                onSubmitReply={onSubmitReply}
                onStartChat={onStartChat}
                onEdit={onEdit}
                onDelete={onDelete}
                onReplyClick={handleReplyClick}
                onStartEdit={handleStartEdit}
              />
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
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-sm text-gray-900 min-h-[60px] resize-none"
                  maxLength={1000}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
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
                          Stick
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{reply.content}</div>
            )}

            {/* CalStick controls */}
            {supportsCalStick && !isEditing && (
              <CalStickControls
                replyId={reply.id}
                context={context}
                isCalStick={reply.is_calstick || false}
                calStickDate={reply.calstick_date || null}
                calStickCompleted={reply.calstick_completed || false}
                isEditing={editingCalStick === reply.id}
                editingDate={calStickDate}
                onToggle={onToggleCalStick}
                onDateChange={(date) => onCalStickDateChange(reply.id, date)}
                onSave={onSaveCalStickDate}
                onCancel={onCancelCalStickEdit}
                onToggleComplete={onToggleCalStickComplete}
              />
            )}

            {/* Collapse/expand button for nested replies */}
            {hasReplies && (
              <button
                type="button"
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
          <InlineReplyForm
            reply={reply}
            depthColors={nextDepthColors}
            replyContent={replyContent}
            isSubmittingReply={isSubmittingReply}
            replyTextareaRef={replyTextareaRef}
            displayName={getDisplayName(reply)}
            onContentChange={setReplyContent}
            onCancel={handleCancelReply}
            onSubmit={handleSubmitInlineReply}
          />
        )}

        {/* Nested replies */}
        {hasReplies && !isCollapsed && (
          <ul className="mt-2 space-y-2">
            {reply.replies!.map((nestedReply) => (
              <ReplyItem
                key={nestedReply.id}
                reply={nestedReply}
                depth={depth + 1}
                context={context}
                supportsCalStick={supportsCalStick}
                editingCalStick={editingCalStick}
                calStickDate={calStickDate}
                currentUserId={currentUserId}
                parentAuthor={getDisplayName(reply)}
                onDelete={onDelete}
                onEdit={onEdit}
                onReply={onReply}
                onSubmitReply={onSubmitReply}
                onStartChat={onStartChat}
                onToggleCalStick={onToggleCalStick}
                onCalStickDateChange={onCalStickDateChange}
                onSaveCalStickDate={onSaveCalStickDate}
                onCancelCalStickEdit={onCancelCalStickEdit}
                onToggleCalStickComplete={onToggleCalStickComplete}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

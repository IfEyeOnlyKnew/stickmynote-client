"use client"

import { useState, useCallback, memo } from "react"
import { Trash2, Pencil, Check, X, MessageSquare, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getTimestampDisplay } from "@/utils/noteUtils"
import { CalStickControls } from "./CalStickControls"
import type React from "react"

import { DEPTH_COLORS, getReplyDisplayName, getReplyInitials, type BaseReply } from "./reply-shared"

export type ThreadedReply = BaseReply

interface ThreadedReplyItemProps {
  reply: ThreadedReply
  depth?: number
  context: string
  supportsCalStick: boolean
  editingCalStick: string | null
  calStickDate: string
  currentUserId?: string | null
  parentAuthor?: string
  onDelete?: (replyId: string) => void
  onEdit?: (replyId: string, content: string) => Promise<void>
  onReply?: (parentReply: ThreadedReply) => void
  onSubmitInlineReply?: (content: string, parentReplyId: string) => Promise<void>
  onToggleCalStick: (replyId: string, currentIsCalStick: boolean, currentDate: string | null) => void
  onCalStickDateChange: (replyId: string, date: string) => void
  onSaveCalStickDate: (replyId: string) => void
  onCancelCalStickEdit: () => void
  onToggleCalStickComplete: (replyId: string, currentCompleted: boolean) => void
}

export const ThreadedReplyItem = memo(function ThreadedReplyItem({
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
  onSubmitInlineReply,
  onToggleCalStick,
  onCalStickDateChange,
  onSaveCalStickDate,
  onCancelCalStickEdit,
  onToggleCalStickComplete,
}: ThreadedReplyItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(reply.content)
  const [isSaving, setIsSaving] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [inlineReplyContent, setInlineReplyContent] = useState("")
  const [isSubmittingInlineReply, setIsSubmittingInlineReply] = useState(false)

  const timestamp = reply.updated_at || reply.created_at
  const displayTime = timestamp ? getTimestampDisplay(timestamp) : "Just now"
  const wasEdited = reply.updated_at && reply.updated_at !== reply.created_at

  const isOwner = currentUserId && reply.user_id && currentUserId === reply.user_id
  const hasReplies = (reply.replies?.length ?? 0) > 0
  const replyCount = reply.replies?.length ?? 0

  const depthColors = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const indentPx = depth * 24

  const getDisplayName = useCallback(getReplyDisplayName, [])
  const getInitials = useCallback(getReplyInitials, [])

  const handleStartEdit = () => { setEditContent(reply.content); setIsEditing(true) }
  const handleCancelEdit = () => { setEditContent(reply.content); setIsEditing(false) }

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

  const handleReply = () => {
    if (onSubmitInlineReply) {
      // Use inline reply form
      setIsReplying(true)
    } else if (onReply) {
      // Fallback to scrolling to main reply form
      onReply(reply)
    }
  }

  const handleCancelInlineReply = () => {
    setIsReplying(false)
    setInlineReplyContent("")
  }

  const handleSubmitInlineReply = async () => {
    if (!onSubmitInlineReply || !inlineReplyContent.trim() || isSubmittingInlineReply) return

    setIsSubmittingInlineReply(true)
    try {
      await onSubmitInlineReply(inlineReplyContent.trim(), reply.id)
      setInlineReplyContent("")
      setIsReplying(false)
    } catch (error) {
      console.error("Error submitting inline reply:", error)
    } finally {
      setIsSubmittingInlineReply(false)
    }
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="relative">
      {/* Thread line for nested replies */}
      {depth > 0 && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-0.5 ${depthColors.line}`}
          style={{ marginLeft: `${(depth - 1) * 24 + 8}px` }}
        />
      )}

      <div
        className="relative"
        style={{ marginLeft: `${indentPx}px` }}
      >
        {/* Horizontal connector line */}
        {depth > 0 && (
          <div
            className={`absolute left-0 top-5 w-4 h-0.5 ${depthColors.line}`}
            style={{ marginLeft: "-16px" }}
          />
        )}

        <div
          className={`rounded-lg p-3 border group transition-colors ${
            depth > 0 ? depthColors.bg : "bg-gray-50"
          }`}
          style={
            {
              "--reply-color": reply.color || "#d1d5db",
              borderLeftColor: depth === 0 ? (reply.color || "#d1d5db") : undefined,
              borderLeftWidth: depth === 0 ? "4px" : undefined,
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
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                {(onReply || onSubmitInlineReply) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReply}
                    className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                    title="Reply to this"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                )}
                {isOwner && !isEditing && onEdit && (
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
                {isOwner && !isEditing && onDelete && (
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
              <div className="space-y-2">
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
              <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                {reply.content}
              </div>
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

            {/* Inline reply form */}
            {isReplying && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className={`flex items-center gap-1 text-xs ${depthColors.text}`}>
                  <CornerDownRight className="h-3 w-3" />
                  <span>Replying to @{getDisplayName(reply)}</span>
                </div>
                <Textarea
                  value={inlineReplyContent}
                  onChange={(e) => setInlineReplyContent(e.target.value)}
                  placeholder="Write your reply..."
                  className="text-sm min-h-[60px] resize-none"
                  maxLength={1000}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{inlineReplyContent.length}/1000</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelInlineReply}
                      disabled={isSubmittingInlineReply}
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
                      disabled={isSubmittingInlineReply || !inlineReplyContent.trim()}
                      className="h-6 px-2 text-xs"
                    >
                      {isSubmittingInlineReply ? (
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
            )}

            {/* Collapse/expand button for nested replies */}
            {hasReplies && (
              <button
                type="button"
                onClick={toggleCollapse}
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

        {/* Nested replies */}
        {hasReplies && !isCollapsed && (
          <div className="mt-2 space-y-2">
            {reply.replies!.map((nestedReply) => (
              <ThreadedReplyItem
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
                onSubmitInlineReply={onSubmitInlineReply}
                onToggleCalStick={onToggleCalStick}
                onCalStickDateChange={onCalStickDateChange}
                onSaveCalStickDate={onSaveCalStickDate}
                onCancelCalStickEdit={onCancelCalStickEdit}
                onToggleCalStickComplete={onToggleCalStickComplete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

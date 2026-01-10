"use client"

import { useState, memo, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Pencil, Trash2, MessageSquare, CheckSquare, AlertCircle, RefreshCw, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

// Depth-based colors for visual distinction of thread levels
const DEPTH_COLORS = [
  { line: "border-blue-400", bg: "bg-blue-50/50", text: "text-blue-600" },
  { line: "border-green-400", bg: "bg-green-50/50", text: "text-green-600" },
  { line: "border-purple-400", bg: "bg-purple-50/50", text: "text-purple-600" },
  { line: "border-orange-400", bg: "bg-orange-50/50", text: "text-orange-600" },
  { line: "border-pink-400", bg: "bg-pink-50/50", text: "text-pink-600" },
  { line: "border-cyan-400", bg: "bg-cyan-50/50", text: "text-cyan-600" },
]

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

  const isOwner = reply.user_id === currentUserId
  const canDelete = isOwner || isPadOwner || isAdmin
  const canEdit = isOwner
  const hasReplies = reply.replies && reply.replies.length > 0
  const replyCount = reply.replies?.length || 0

  // Get depth-based styling
  const depthColors = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const indentPx = depth * 24 // 24px per level

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

        <Card className={`border shadow-sm ${depth > 0 ? depthColors.bg : "bg-white"}`}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                {reply.users?.avatar_url && (
                  <AvatarImage src={reply.users.avatar_url} alt={getDisplayName(reply)} />
                )}
                <AvatarFallback className="text-xs">{getInitials(reply)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-semibold text-gray-900">{getDisplayName(reply)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {reply.category}
                    </Badge>
                    {reply.calstick_id && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={`text-xs flex items-center gap-1 ${
                                hasCalstickChanges
                                  ? "border-amber-400 bg-amber-50 text-amber-700"
                                  : "border-purple-400 bg-purple-50 text-purple-700"
                              }`}
                            >
                              {isCheckingSync ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : hasCalstickChanges ? (
                                <AlertCircle className="h-3 w-3" />
                              ) : (
                                <CheckSquare className="h-3 w-3" />
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
                    <span className="text-gray-500">
                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                    {reply.updated_at !== reply.created_at && (
                      <span className="text-xs text-gray-400">(edited)</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {hasCalstickChanges && onSyncFromCalStick && !isEditing && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={handleSyncFromCalStick}
                              disabled={isSyncing}
                              title="Sync from CalStick"
                            >
                              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Update reply with CalStick changes
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canEdit && !isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleStartEdit}
                        title="Edit reply"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && !isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(reply.id)}
                        title="Delete reply"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onReply(reply)}
                        title="Reply to this comment"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Replying to indicator */}
                {parentAuthor && depth > 0 && (
                  <div className={`flex items-center gap-1 text-xs ${depthColors.text} mb-2`}>
                    <CornerDownRight className="h-3 w-3" />
                    <span>Replying to @{parentAuthor}</span>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      className="text-sm resize-none"
                      style={{ minHeight: "80px", height: "80px" }}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{editContent.length}/1000</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSaving || !editContent.trim()}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{reply.content}</p>
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
          </CardContent>
        </Card>

        {/* Nested replies */}
        {hasReplies && !isCollapsed && (
          <div className="space-y-3 mt-3">
            {reply.replies!.map((nestedReply) => renderNestedReply(nestedReply, depth + 1, getDisplayName(reply)))}
          </div>
        )}
      </div>
    </div>
  )
})

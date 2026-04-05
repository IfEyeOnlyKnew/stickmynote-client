"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2,
  Pin,
  PinOff,
  Send,
  MessageCircle,
  CornerDownRight,
  X,
  Trash2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/contexts/user-context"
import { GenericStickTabs } from "@/components/GenericStickTabs"
import {
  getConcurStickTabs,
  saveConcurStickTab,
  deleteConcurStickTabItem,
} from "@/lib/concur-stick-tabs"
import type { StickTabsConfig } from "@/types/stick-tabs-config"

// ============================================================================
// Types
// ============================================================================

interface ConcurStick {
  id: string
  topic: string | null
  content: string
  color: string
  is_pinned: boolean
  user_id: string
  created_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  reply_count: number
}

interface Reply {
  id: string
  content: string
  color: string | null
  category: string | null
  created_at: string
  updated_at: string
  user_id: string
  parent_reply_id: string | null
  stick_id: string
  users: {
    id: string
    full_name: string | null
    username: string | null
    email: string | null
    avatar_url: string | null
  } | null
  replies?: Reply[]
}

interface ConcurStickDetailModalProps {
  groupId: string
  groupName: string
  groupLogoUrl?: string | null
  groupHeaderImageUrl?: string | null
  stick: ConcurStick
  isOwner: boolean
  onClose: () => void
  onStickUpdated: () => void
}

// ============================================================================
// Constants
// ============================================================================

const MAX_REPLY_DEPTH = 5

const DEPTH_COLORS = [
  { line: "border-blue-400", bg: "bg-blue-50" },
  { line: "border-green-400", bg: "bg-green-50" },
  { line: "border-purple-400", bg: "bg-purple-50" },
  { line: "border-orange-400", bg: "bg-orange-50" },
  { line: "border-pink-400", bg: "bg-pink-50" },
]

// ============================================================================
// Component
// ============================================================================

export function ConcurStickDetailModal({
  groupId,
  groupName,
  groupLogoUrl,
  groupHeaderImageUrl,
  stick,
  isOwner,
  onClose,
  onStickUpdated,
}: Readonly<ConcurStickDetailModalProps>) {
  const { toast } = useToast()
  const { user } = useUser()
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState("")
  const [replyingTo, setReplyingTo] = useState<Reply | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pinning, setPinning] = useState(false)
  const [topic, setTopic] = useState(stick.topic || "")
  const [content, setContent] = useState(stick.content)
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)

  const handleSaveStick = async () => {
    try {
      const res = await fetch(`/api/concur/groups/${groupId}/sticks/${stick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content }),
      })
      if (!res.ok) throw new Error("Failed")
      setIsEditingTopic(false)
      setIsEditingContent(false)
      onStickUpdated()
      toast({ title: "Stick updated" })
    } catch {
      toast({ title: "Failed to save stick", variant: "destructive" })
    }
  }

  const handleCancelEdit = () => {
    setTopic(stick.topic || "")
    setContent(stick.content)
    setIsEditingTopic(false)
    setIsEditingContent(false)
  }

  // Create a StickTabsConfig that curries the groupId into the concur API calls
  const tabsConfig: StickTabsConfig = useMemo(() => ({
    getStickTabs: (stickId: string) => getConcurStickTabs(groupId, stickId),
    saveStickTab: (stickId: string, tabType: "video" | "videos" | "images", data: any) =>
      saveConcurStickTab(groupId, stickId, tabType, data),
    deleteStickTabItem: (stickId: string, tabType: "video" | "videos" | "images", itemId: string) =>
      deleteConcurStickTabItem(groupId, stickId, tabType, itemId),
    idFieldName: "stick_id",
    supportsExportDeletion: false,
    isStick: true,
  }), [groupId])

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/concur/groups/${groupId}/sticks/${stick.id}/replies`
      )
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setReplies(data.replies || [])
    } catch (error) {
      console.error("Failed to fetch replies:", error)
    } finally {
      setLoading(false)
    }
  }, [groupId, stick.id])

  useEffect(() => {
    fetchReplies()
  }, [fetchReplies])

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/concur/groups/${groupId}/sticks/${stick.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: replyContent.trim(),
            parent_reply_id: replyingTo?.id || null,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        toast({ title: data.error || "Failed to post reply", variant: "destructive" })
        return
      }

      setReplyContent("")
      setReplyingTo(null)
      fetchReplies()
      onStickUpdated()
    } catch {
      toast({ title: "Failed to post reply", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePin = async () => {
    setPinning(true)
    try {
      const res = await fetch(
        `/api/concur/groups/${groupId}/sticks/${stick.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pinned: !stick.is_pinned }),
        }
      )
      if (!res.ok) throw new Error("Failed")
      onStickUpdated()
      toast({ title: stick.is_pinned ? "Stick unpinned" : "Stick pinned" })
    } catch {
      toast({ title: "Failed to toggle pin", variant: "destructive" })
    } finally {
      setPinning(false)
    }
  }

  const handleDeleteReply = async (replyId: string) => {
    try {
      const res = await fetch(
        `/api/concur/groups/${groupId}/sticks/${stick.id}/replies?replyId=${replyId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed")
      fetchReplies()
      toast({ title: "Reply deleted" })
    } catch {
      toast({ title: "Failed to delete reply", variant: "destructive" })
    }
  }

  const handleReplyToReply = (reply: Reply) => {
    setReplyingTo(reply)
    replyInputRef.current?.focus()
  }

  // Build threaded reply tree
  const threadedReplies = buildReplyTree(replies)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header image banner */}
        {groupHeaderImageUrl && (
          <div className="relative h-32 shrink-0">
            <img
              src={groupHeaderImageUrl}
              alt=""
              className="w-full h-full object-cover rounded-t-lg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-t-lg" />
            <div className="absolute bottom-2.5 left-3 flex items-center gap-2">
              {groupLogoUrl && (
                <img
                  src={groupLogoUrl}
                  alt=""
                  className="h-7 w-7 rounded object-cover border border-white/30 shadow-sm"
                />
              )}
              <span className="text-sm font-semibold text-white drop-shadow-sm">
                {groupName}
              </span>
            </div>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePin}
                disabled={pinning}
                className="absolute top-2 right-2 text-white hover:bg-white/20"
              >
                {pinning && <Loader2 className="h-4 w-4 animate-spin" />}
                {!pinning && stick.is_pinned && <PinOff className="h-4 w-4" />}
                {!pinning && !stick.is_pinned && <Pin className="h-4 w-4" />}
              </Button>
            )}
          </div>
        )}

        {/* Header (fallback when no header image) */}
        {!groupHeaderImageUrl && (
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-start justify-between">
              <DialogTitle className="text-lg flex items-center gap-2">
                {groupLogoUrl && (
                  <img
                    src={groupLogoUrl}
                    alt=""
                    className="h-6 w-6 rounded object-cover"
                  />
                )}
                {groupName}
              </DialogTitle>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTogglePin}
                  disabled={pinning}
                  className="shrink-0"
                >
                  {pinning && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!pinning && stick.is_pinned && <PinOff className="h-4 w-4" />}
                  {!pinning && !stick.is_pinned && <Pin className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </DialogHeader>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {/* Stick Tabs (Main, Videos, Images, Details) */}
          <div className="mb-4">
            <GenericStickTabs
              stickId={stick.id}
              initialTopic={stick.topic || ""}
              initialContent={stick.content}
              onTopicChange={(v) => { setTopic(v); setIsEditingTopic(true) }}
              onContentChange={(v) => { setContent(v); setIsEditingContent(true) }}
              readOnly={false}
              showMedia={true}
              config={tabsConfig}
              isEditingTopic={isEditingTopic}
              isEditingContent={isEditingContent}
              onCancelTopic={handleCancelEdit}
              onCancelContent={handleCancelEdit}
              onStickTopic={handleSaveStick}
              onStickContent={handleSaveStick}
              stickType="concur"
            />
          </div>

          {/* Stick metadata */}
          <div className="flex items-center gap-2 mb-4 px-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={stick.user?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {stick.user?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {stick.user?.full_name || "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Replies */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              Replies ({replies.length})
            </h3>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && threadedReplies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No replies yet. Be the first to respond!
              </p>
            )}
            {!loading && threadedReplies.length > 0 && (
              <div className="space-y-2">
                {threadedReplies.map((reply) =>
                  renderReply(reply, 0, user?.id, isOwner, handleDeleteReply, handleReplyToReply)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reply Input */}
        <div className="p-4 border-t bg-gray-50/80">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-white rounded px-2 py-1">
              <CornerDownRight className="h-3 w-3" />
              <span>
                Replying to{" "}
                <strong>{replyingTo.users?.full_name || "Unknown"}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-auto"
                onClick={() => setReplyingTo(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={replyInputRef}
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmitReply()
                }
              }}
              rows={2}
              className="resize-none"
              disabled={submitting}
            />
            <Button
              onClick={handleSubmitReply}
              disabled={submitting || !replyContent.trim()}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
              size="sm"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Ctrl+Enter to send
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Reply Tree Builder
// ============================================================================

function buildReplyTree(replies: Reply[]): Reply[] {
  const map = new Map<string, Reply>()
  const roots: Reply[] = []

  // Initialize all replies
  for (const reply of replies) {
    map.set(reply.id, { ...reply, replies: [] })
  }

  // Build tree
  for (const reply of replies) {
    const node = map.get(reply.id)!
    if (reply.parent_reply_id && map.has(reply.parent_reply_id)) {
      const parent = map.get(reply.parent_reply_id)!
      parent.replies = parent.replies || []
      parent.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// ============================================================================
// Reply Renderer (Recursive)
// ============================================================================

function renderReply(
  reply: Reply,
  depth: number,
  currentUserId: string | undefined,
  isOwner: boolean,
  onDelete: (replyId: string) => void,
  onReplyTo: (reply: Reply) => void
): React.ReactNode {
  const depthColor = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const canDelete = reply.user_id === currentUserId || isOwner

  return (
    <div key={reply.id} style={{ marginLeft: Math.min(depth * 16, 80) }}>
      <div
        className={`p-3 rounded-lg border-l-2 ${depthColor.line} ${
          depth > 0 ? depthColor.bg : "bg-white"
        } mb-2`}
      >
        {/* Reply header */}
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={reply.users?.avatar_url || undefined} />
            <AvatarFallback className="text-[8px]">
              {reply.users?.full_name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">
            {reply.users?.full_name || "Unknown"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Reply content */}
        <p className="text-sm whitespace-pre-wrap">{reply.content}</p>

        {/* Reply actions */}
        <div className="flex items-center gap-1 mt-2">
          {depth < MAX_REPLY_DEPTH && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-muted-foreground"
              onClick={() => onReplyTo(reply)}
            >
              <CornerDownRight className="h-3 w-3 mr-1" />
              Reply
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-red-500 hover:text-red-700"
              onClick={() => onDelete(reply.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {reply.replies && reply.replies.length > 0 && (
        <div>
          {reply.replies.map((child) =>
            renderReply(child, depth + 1, currentUserId, isOwner, onDelete, onReplyTo)
          )}
        </div>
      )}
    </div>
  )
}

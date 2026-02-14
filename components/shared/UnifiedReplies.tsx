"use client"

import dynamic from "next/dynamic"
import { MessageSquare, Plus, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ReplyItem } from "@/components/replies/ReplyItem"
import { ReplyForm } from "@/components/replies/ReplyForm"
import { ChatModal } from "@/components/chat/ChatModal"
import type React from "react"
import { useCallback, useState, useEffect, useRef, useMemo } from "react"

// CollaborativeReplyForm uses Tiptap which requires client-side only rendering
const CollaborativeReplyForm = dynamic(
  () => import("@/components/replies/CollaborativeReplyForm").then((mod) => mod.CollaborativeReplyForm),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 border rounded-md bg-gray-50">
        <div className="animate-pulse text-gray-500 text-sm">Loading reply form...</div>
      </div>
    )
  }
)
import { toast } from "sonner"

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
    full_name?: string
  }
  is_calstick?: boolean
  calstick_date?: string | null
  calstick_completed?: boolean
  calstick_completed_at?: string | null
  parent_reply_id?: string | null
  replies?: Reply[]
}

// Build a tree structure from flat replies array
function buildReplyTree(replies: Reply[]): Reply[] {
  const replyMap = new Map<string, Reply>()
  const rootReplies: Reply[] = []

  // First pass: create map with empty replies array
  replies.forEach((reply) => {
    replyMap.set(reply.id, { ...reply, replies: [] })
  })

  // Second pass: build tree by parent_reply_id
  replies.forEach((reply) => {
    const replyWithChildren = replyMap.get(reply.id)!
    if (reply.parent_reply_id && replyMap.has(reply.parent_reply_id)) {
      const parent = replyMap.get(reply.parent_reply_id)!
      parent.replies = parent.replies || []
      parent.replies.push(replyWithChildren)
    } else {
      rootReplies.push(replyWithChildren)
    }
  })

  // All replies: oldest first (natural conversation flow, like chat)
  rootReplies.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    return timeA - timeB // Oldest first (smaller timestamp first)
  })

  // Nested replies: also oldest first
  const sortNestedReplies = (reps: Reply[]) => {
    reps.forEach((reply) => {
      if (reply.replies && reply.replies.length > 0) {
        reply.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        sortNestedReplies(reply.replies)
      }
    })
  }
  sortNestedReplies(rootReplies)

  return rootReplies
}

interface Tone {
  value: string
  label: string
}

interface UnifiedRepliesProps {
  // Core props
  noteId: string
  replies: Reply[]
  replyCount: number
  replyContent: string
  setReplyContent: (content: string) => void
  isSubmittingReply: boolean

  // Context-specific props
  context: "card" | "panel" | "fullscreen" | "stick"
  isNewNote?: boolean
  showReplyForm?: boolean

  // Feature flags
  enableSummary?: boolean
  enableExport?: boolean
  enableFullscreenButton?: boolean
  enableCollaboration?: boolean

  // Summary props (when enableSummary is true)
  isGeneratingSummary?: boolean
  replySummary?: string | null
  selectedTone?: string
  setSelectedTone?: (tone: string) => void
  tones?: Tone[]

  // Export props (when enableExport is true)
  isExporting?: boolean
  onExportAll?: () => void
  onGenerateSummaryDocx?: (tone: string) => void

  // Event handlers
  onOpenFullscreen?: (noteId: string) => void
  onAddReplyClick?: (e: React.MouseEvent) => void
  onCancelReply?: (e: React.MouseEvent) => void
  onStickReply?: (e: React.MouseEvent) => void
  onAddReply?: (noteId: string, content: string, color?: string, parentReplyId?: string | null) => Promise<void>
  onGenerateSummary?: (tone: string) => void

  // Additional props for different contexts
  canEdit?: boolean
  setIsSubmittingReply?: (submitting: boolean) => void
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  currentUserId?: string | null
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>

  // Reply-to-reply support
  enableReplyToReply?: boolean

  // Real-time polling for replies (chat-like experience)
  enablePolling?: boolean
  pollingInterval?: number
  onRepliesUpdated?: (replies: Reply[]) => void
}

export const UnifiedReplies: React.FC<UnifiedRepliesProps> = ({
  noteId,
  replies,
  replyCount,
  replyContent,
  setReplyContent,
  isSubmittingReply,
  context,
  isNewNote = false,
  showReplyForm = false,
  enableSummary = false,
  enableExport = false,
  enableFullscreenButton = false,
  enableCollaboration = context === "fullscreen" || context === "stick",
  isGeneratingSummary = false,
  replySummary,
  selectedTone = "professional",
  setSelectedTone,
  tones = [],
  isExporting = false,
  onExportAll,
  onGenerateSummaryDocx,
  onOpenFullscreen,
  onAddReplyClick,
  onCancelReply,
  onStickReply,
  onAddReply,
  onGenerateSummary,
  canEdit = true,
  setIsSubmittingReply,
  onDeleteReply,
  currentUserId,
  onEditReply,
  enableReplyToReply = true,
  enablePolling = false,
  pollingInterval = 5000,
  onRepliesUpdated,
}) => {
  const [editingCalStick, setEditingCalStick] = useState<string | null>(null)
  const [calStickDates, setCalStickDates] = useState<Record<string, string>>({})
  const [localReplies, setLocalReplies] = useState<Reply[]>(replies)
  const [replyingTo, setReplyingTo] = useState<Reply | null>(null)

  // Chat modal state
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatParentReply, setChatParentReply] = useState<Reply | null>(null)

  // Refs for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastReplyIdsRef = useRef<string>("")
  const localRepliesRef = useRef<Reply[]>(replies)

  // Keep the ref in sync with state
  useEffect(() => {
    localRepliesRef.current = localReplies
  }, [localReplies])

  useEffect(() => {
    setLocalReplies(replies)
    // Update the ref when replies change from parent
    lastReplyIdsRef.current = replies.map((r: Reply) => r.id).join(",")
  }, [replies])

  // Real-time polling for replies
  useEffect(() => {
    if (!enablePolling || !noteId || isNewNote) return

    const fetchReplies = async () => {
      try {
        // Determine the correct API endpoint based on context
        const apiEndpoint = context === "stick"
          ? `/api/sticks/${noteId}/replies`
          : `/api/notes/${noteId}/replies`

        const timestamp = Date.now()
        const response = await fetch(`${apiEndpoint}?t=${timestamp}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        })

        if (response.ok) {
          const data = await response.json()
          const serverReplies: Reply[] = data.replies || []
          const currentLocalReplies = localRepliesRef.current

          // Create sets for comparison
          const serverReplyIds = new Set(serverReplies.map((r: Reply) => r.id))
          const localReplyIds = new Set(currentLocalReplies.map((r: Reply) => r.id))

          // Check if server has new replies we don't have locally
          const hasNewFromServer = serverReplies.some((r: Reply) => !localReplyIds.has(r.id))

          // Check if we have local replies not yet on server (optimistic additions)
          const hasLocalOnlyReplies = currentLocalReplies.some((r: Reply) => !serverReplyIds.has(r.id))

          if (hasNewFromServer) {
            // Merge: keep local-only replies + add all server replies
            const localOnlyReplies = currentLocalReplies.filter((r: Reply) => !serverReplyIds.has(r.id))
            const mergedReplies = [...serverReplies, ...localOnlyReplies]

            setLocalReplies(mergedReplies)
            lastReplyIdsRef.current = mergedReplies.map((r: Reply) => r.id).join(",")
            // Notify parent of updates if callback provided
            onRepliesUpdated?.(mergedReplies)
          } else if (!hasLocalOnlyReplies) {
            // No local-only replies and no new from server - just update to server state
            // This handles cases where replies were deleted on server
            const serverIds = serverReplies.map((r: Reply) => r.id).join(",")
            if (serverIds !== lastReplyIdsRef.current) {
              setLocalReplies(serverReplies)
              lastReplyIdsRef.current = serverIds
              onRepliesUpdated?.(serverReplies)
            }
          }
          // If we have local-only replies and no new from server, keep local state
          // This preserves optimistically-added replies until server confirms them
        }
      } catch (error) {
        console.error("Error polling replies:", error)
      }
    }

    // Start polling
    pollingIntervalRef.current = setInterval(fetchReplies, pollingInterval)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [enablePolling, noteId, context, isNewNote, pollingInterval, onRepliesUpdated])

  const handleReplyToReply = useCallback((reply: Reply) => {
    setReplyingTo(reply)
    // Prepend @username to the reply content
    const username = reply.user?.username || reply.user?.email || "User"
    setReplyContent(`@${username} `)
    // Focus on the reply form (scroll to it)
    setTimeout(() => {
      const replyForm = document.querySelector('[data-reply-form]')
      if (replyForm) {
        replyForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const textarea = replyForm.querySelector('textarea')
        if (textarea) {
          textarea.focus()
        }
      }
    }, 100)
  }, [setReplyContent])

  // Handler for starting a chat when depth limit is reached
  const handleStartChat = useCallback((parentReply: Reply) => {
    setChatParentReply(parentReply)
    setChatModalOpen(true)
  }, [])

  const supportsCalStick = context === "stick"

  const handleStickReply = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const trimmedContent = replyContent.trim()
      if (!trimmedContent || isSubmittingReply) return

      if (onAddReply && setIsSubmittingReply) {
        setIsSubmittingReply(true)
        try {
          const parentReplyId = replyingTo?.id || null
          await onAddReply(noteId, trimmedContent, undefined, parentReplyId)
          setReplyContent("")
          setReplyingTo(null)
        } catch (error) {
          console.error("Error adding reply:", error)
        } finally {
          setIsSubmittingReply(false)
        }
      } else if (onStickReply) {
        onStickReply(e)
      }
    },
    [replyContent, isSubmittingReply, onAddReply, onStickReply, noteId, setReplyContent, setIsSubmittingReply, replyingTo],
  )

  const handleGenerateSummary = useCallback(
    async (tone: string) => {
      if (replies.length === 0 || isGeneratingSummary || !onGenerateSummary) return
      onGenerateSummary(tone)
    },
    [replies, isGeneratingSummary, onGenerateSummary],
  )

  // Direct inline reply submit handler - called from ReplyItem with parentReplyId
  const handleSubmitInlineReply = useCallback(
    async (content: string, parentReplyId: string) => {
      if (!onAddReply) return
      await onAddReply(noteId, content, undefined, parentReplyId)
    },
    [onAddReply, noteId],
  )

  const handleDeleteReply = useCallback(
    async (replyId: string) => {
      if (!onDeleteReply) return

      try {
        await onDeleteReply(noteId, replyId)
        setLocalReplies((prev) => prev.filter((r) => r.id !== replyId))
      } catch (error) {
        console.error("Error deleting reply:", error)
      }
    },
    [onDeleteReply, noteId],
  )

  const handleEditReply = useCallback(
    async (replyId: string, content: string) => {
      if (!onEditReply) return

      await onEditReply(noteId, replyId, content)
      // Update local state after successful edit
      setLocalReplies((prev) =>
        prev.map((r) => (r.id === replyId ? { ...r, content, updated_at: new Date().toISOString() } : r)),
      )
    },
    [onEditReply, noteId],
  )

  const handleToggleCalStick = useCallback(
    async (replyId: string, currentIsCalStick: boolean, currentDate: string | null) => {
      try {
        const newIsCalStick = !currentIsCalStick

        if (newIsCalStick) {
          setEditingCalStick(replyId)
          setCalStickDates((prev) => ({
            ...prev,
            [replyId]: currentDate || new Date().toISOString().split("T")[0],
          }))
          return
        }

        const response = await fetch(`/api/sticks/replies/${replyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_calstick: false,
            calstick_date: null,
            calstick_completed: false,
            calstick_completed_at: null,
          }),
        })

        if (!response.ok) throw new Error("Failed to update CalStick")

        setLocalReplies((prev) =>
          prev.map((r) =>
            r.id === replyId
              ? {
                  ...r,
                  is_calstick: false,
                  calstick_date: null,
                  calstick_completed: false,
                  calstick_completed_at: null,
                }
              : r,
          ),
        )

        toast.success("CalStick removed")
      } catch (error) {
        console.error("Error toggling CalStick:", error)
        toast.error("Failed to update CalStick")
      }
    },
    [],
  )

  const handleCalStickDateChange = useCallback((replyId: string, date: string) => {
    setCalStickDates((prev) => ({
      ...prev,
      [replyId]: date,
    }))
  }, [])

  const handleSaveCalStickDate = useCallback(
    async (replyId: string) => {
      try {
        const date = calStickDates[replyId]
        if (!date) {
          toast.error("Please select a date")
          return
        }

        const response = await fetch(`/api/sticks/replies/${replyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_calstick: true,
            calstick_date: date,
          }),
        })

        if (!response.ok) throw new Error("Failed to save CalStick date")

        setLocalReplies((prev) =>
          prev.map((r) => (r.id === replyId ? { ...r, is_calstick: true, calstick_date: date } : r)),
        )

        toast.success("CalStick task created")
        setEditingCalStick(null)
      } catch (error) {
        console.error("Error saving CalStick date:", error)
        toast.error("Failed to save CalStick date")
      }
    },
    [calStickDates],
  )

  const handleToggleCalStickComplete = useCallback(async (replyId: string, currentCompleted: boolean) => {
    try {
      const newCompleted = !currentCompleted
      const response = await fetch(`/api/sticks/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calstick_completed: newCompleted,
          calstick_completed_at: newCompleted ? new Date().toISOString() : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to update completion status")

      setLocalReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? {
                ...r,
                calstick_completed: newCompleted,
                calstick_completed_at: newCompleted ? new Date().toISOString() : null,
              }
            : r,
        ),
      )

      toast.success(newCompleted ? "Task completed!" : "Task marked incomplete")
    } catch (error) {
      console.error("Error toggling completion:", error)
      toast.error("Failed to update task")
    }
  }, [])

  // Build threaded reply tree from flat list
  // Use localReplies if it has data, otherwise fall back to props.replies
  // This handles the initial render before the useEffect syncs state
  const repliesToThread = localReplies.length > 0 ? localReplies : replies
  const threadedReplies = useMemo(() => buildReplyTree(repliesToThread), [repliesToThread])

  if (isNewNote) return null

  // Card context uses compact layout (just buttons)
  // Panel context now shows full threaded replies
  const isCompactLayout = context === "card" || (context === "stick" && showReplyForm)

  if (isCompactLayout) {
    return (
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          {replyCount > 0 && enableFullscreenButton && onOpenFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onOpenFullscreen(noteId)
              }}
              className="text-xs h-6"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              {replyCount} {replyCount === 1 ? "Reply" : "Replies"}
            </Button>
          )}

          {!showReplyForm && onAddReplyClick && (
            <Button variant="outline" size="sm" onClick={onAddReplyClick} className="text-xs h-6 bg-transparent">
              <Plus className="h-3 w-3 mr-1" />
              Add Reply
            </Button>
          )}
        </div>

        {showReplyForm && onCancelReply && onStickReply && (
          <ReplyForm
            content={replyContent}
            onContentChange={setReplyContent}
            onSubmit={onStickReply}
            onCancel={onCancelReply}
            isSubmitting={isSubmittingReply}
            isCompact={true}
          />
        )}
      </div>
    )
  }

  // Panel context - show full threaded replies inline
  if (context === "panel") {
    return (
      <div className="mt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Replies ({replyCount})</h4>
          {replyCount > 0 && enableFullscreenButton && onOpenFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onOpenFullscreen(noteId)
              }}
              className="text-xs h-6 text-blue-600 hover:text-blue-700"
            >
              Open Fullscreen
            </Button>
          )}
        </div>

        {/* Threaded replies list */}
        {threadedReplies.length > 0 && (
          <ul className="space-y-2">
            {threadedReplies.map((reply, index) => (
              <ReplyItem
                key={reply.id || `reply-${index}`}
                reply={reply}
                depth={0}
                context={context}
                supportsCalStick={supportsCalStick}
                editingCalStick={editingCalStick}
                calStickDate={calStickDates[reply.id] || ""}
                currentUserId={currentUserId}
                onDelete={onDeleteReply ? handleDeleteReply : undefined}
                onEdit={onEditReply ? handleEditReply : undefined}
                onReply={undefined}
                onSubmitReply={enableReplyToReply && canEdit && onAddReply ? handleSubmitInlineReply : undefined}
                onStartChat={handleStartChat}
                onToggleCalStick={handleToggleCalStick}
                onCalStickDateChange={handleCalStickDateChange}
                onSaveCalStickDate={handleSaveCalStickDate}
                onCancelCalStickEdit={() => setEditingCalStick(null)}
                onToggleCalStickComplete={handleToggleCalStickComplete}
              />
            ))}
          </ul>
        )}

        {localReplies.length === 0 && (
          <p className="text-gray-400 text-xs text-center py-4">No replies yet</p>
        )}

        {/* Add new top-level reply button/form */}
        {canEdit && (
          <div className="pt-2 border-t">
            {showReplyForm ? (
              <ReplyForm
                content={replyContent}
                onContentChange={setReplyContent}
                onSubmit={handleStickReply}
                onCancel={onCancelReply}
                isSubmitting={isSubmittingReply}
                isCompact={true}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddReplyClick}
                className="text-xs h-7 w-full bg-transparent"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Reply
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderHeader = () => (
    <div className="p-4 border-b flex-shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Replies ({replyCount})</h3>
        {replies.length > 0 ? (
          <div className="flex items-center gap-2">
            {enableExport && onExportAll && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isExporting} className="text-xs h-7 bg-transparent">
                    {isExporting ? (
                      <>
                        <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        Export
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                  {tones.map((tone) => (
                    <DropdownMenuItem
                      key={tone.value}
                      onClick={() => {
                        onExportAll()
                      }}
                      className="text-xs cursor-pointer hover:bg-gray-100 px-3 py-2"
                    >
                      Export as {tone.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {enableSummary && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isGeneratingSummary}
                    className="text-xs h-7 bg-transparent"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                        Generating...
                      </>
                    ) : (
                      <>
                        Summary
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                  {tones.map((tone) => (
                    <DropdownMenuItem
                      key={`text-${tone.value}`}
                      onClick={() => handleGenerateSummary(tone.value)}
                      className="text-xs cursor-pointer hover:bg-gray-100 px-3 py-2"
                    >
                      {tone.label}
                    </DropdownMenuItem>
                  ))}
                  {onGenerateSummaryDocx && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      {tones.map((tone) => (
                        <DropdownMenuItem
                          key={`docx-${tone.value}`}
                          onClick={() => onGenerateSummaryDocx(tone.value)}
                          className="text-xs cursor-pointer hover:bg-gray-100 px-3 py-2"
                        >
                          {tone.label} (Word Doc)
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          enableSummary && <div className="text-xs text-gray-500">(Add replies to enable Summary)</div>
        )}
      </div>
    </div>
  )

  const renderReplies = () => (
    <>
      {replySummary && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Reply Summary</h4>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{replySummary}</p>
        </div>
      )}

      {threadedReplies.length > 0 && (
        <ul className="space-y-3 mb-4" key="replies-list">
          {threadedReplies.map((reply, index) => (
              <ReplyItem
                key={reply.id || `reply-${index}`}
                reply={reply}
                depth={0}
                context={context}
                supportsCalStick={supportsCalStick}
                editingCalStick={editingCalStick}
                calStickDate={calStickDates[reply.id] || ""}
                currentUserId={currentUserId}
                onDelete={onDeleteReply ? handleDeleteReply : undefined}
                onEdit={onEditReply ? handleEditReply : undefined}
                onReply={enableReplyToReply && canEdit && !onAddReply ? handleReplyToReply : undefined}
                onSubmitReply={enableReplyToReply && canEdit && onAddReply ? handleSubmitInlineReply : undefined}
                onStartChat={handleStartChat}
                onToggleCalStick={handleToggleCalStick}
                onCalStickDateChange={handleCalStickDateChange}
                onSaveCalStickDate={handleSaveCalStickDate}
                onCancelCalStickEdit={() => setEditingCalStick(null)}
                onToggleCalStickComplete={handleToggleCalStickComplete}
              />
            ))}
        </ul>
      )}

      {localReplies.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No replies yet</p>}
    </>
  )

  if (context === "fullscreen" || context === "stick") {
    return (
      <>
        <div className="bg-white rounded-lg shadow-md border flex flex-col min-w-0 h-full">
          {renderHeader()}

          {canEdit && !isNewNote && (
            <div className="p-4 border-b bg-white flex-shrink-0" data-reply-form>
              {replyingTo && (
                <div className="mb-2 flex items-center justify-between text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  <span>Replying to @{replyingTo.user?.username || replyingTo.user?.email || "User"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyContent("")
                    }}
                    className="text-blue-400 hover:text-blue-600"
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {enableCollaboration ? (
                <CollaborativeReplyForm
                  replyId={`${noteId}-new-reply`}
                  content={replyContent}
                  onContentChange={setReplyContent}
                  onSubmit={handleStickReply}
                  isSubmitting={isSubmittingReply}
                  isCompact={false}
                  enableCollaboration={enableCollaboration}
                />
              ) : (
                <ReplyForm
                  content={replyContent}
                  onContentChange={setReplyContent}
                  onSubmit={handleStickReply}
                  isSubmitting={isSubmittingReply}
                  isCompact={false}
                />
              )}
            </div>
          )}

          <div className="p-4 flex-1 overflow-y-auto overflow-x-hidden text-gray-900 min-w-0">{renderReplies()}</div>
        </div>

        {/* Chat Modal for deep thread conversations */}
        {chatParentReply && (
          <ChatModal
            open={chatModalOpen}
            onOpenChange={setChatModalOpen}
            parentReply={chatParentReply}
            parentNoteId={noteId}
            context={context === "stick" ? "stick" : "note"}
            currentUserId={currentUserId || ""}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="w-full lg:w-1/2 lg:flex-shrink-0 mt-6 lg:mt-0">
        <div className="bg-white rounded-lg shadow-md border h-fit">
          {renderHeader()}
          <div className="p-4 max-h-[600px] overflow-y-auto text-gray-900">{renderReplies()}</div>
        </div>
      </div>

      {/* Chat Modal for deep thread conversations */}
      {chatParentReply && (
        <ChatModal
          open={chatModalOpen}
          onOpenChange={setChatModalOpen}
          parentReply={chatParentReply}
          parentNoteId={noteId}
          context={context === "stick" ? "stick" : "note"}
          currentUserId={currentUserId || ""}
        />
      )}
    </>
  )
}

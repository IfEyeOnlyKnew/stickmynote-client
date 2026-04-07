"use client"

import dynamic from "next/dynamic"
import { MessageSquare, Plus, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ThreadedReplyItem, type ThreadedReply } from "./ThreadedReplyItem"
import { ReplyForm } from "./ReplyForm"
import type React from "react"
import { useCallback, useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { buildReplyTree, sortNestedReplies, countAllReplies, getReplyDisplayName } from "./reply-shared"

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

interface Tone {
  value: string
  label: string
}

interface ThreadedRepliesProps {
  // Core props
  noteId: string
  replies: ThreadedReply[]
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
  enableThreading?: boolean

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
  onAddReply?: (noteId: string, content: string, isCalStick: boolean, calStickDate: string | null, parentReplyId?: string | null) => Promise<void>
  onGenerateSummary?: (tone: string) => void

  // Additional props for different contexts
  canEdit?: boolean
  setIsSubmittingReply?: (submitting: boolean) => void
  onDeleteReply?: (noteId: string, replyId: string) => Promise<void>
  currentUserId?: string | null
  onEditReply?: (noteId: string, replyId: string, content: string) => Promise<void>
}

// Helper function to build thread tree from flat replies array (newest-first root sort for ThreadedReplies)
function buildThreadedReplyTree(replies: ThreadedReply[]): ThreadedReply[] {
  const rootReplies = buildReplyTree(replies)
  // Sort root replies by created_at (newest first) - ThreadedReplies-specific
  rootReplies.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  // Sort nested replies oldest first for natural conversation flow
  sortNestedReplies(rootReplies)
  return rootReplies
}

export const ThreadedReplies: React.FC<ThreadedRepliesProps> = ({
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
  enableThreading = true,
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
}) => {
  const [editingCalStick, setEditingCalStick] = useState<string | null>(null)
  const [calStickDates, setCalStickDates] = useState<Record<string, string>>({})
  const [localReplies, setLocalReplies] = useState<ThreadedReply[]>(replies)
  const [replyingTo, setReplyingTo] = useState<ThreadedReply | null>(null)

  useEffect(() => {
    setLocalReplies(replies)
  }, [replies])

  // Build the threaded reply tree
  const threadedReplies = useMemo(() => {
    if (!enableThreading) {
      // Return flat list sorted by newest first
      return [...localReplies].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }
    return buildThreadedReplyTree(localReplies)
  }, [localReplies, enableThreading])

  const totalReplyCount = useMemo(() => {
    return enableThreading ? countAllReplies(threadedReplies) : localReplies.length
  }, [threadedReplies, localReplies, enableThreading])

  const supportsCalStick = context === "stick"

  const handleStickReply = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const trimmedContent = replyContent.trim()
      if (!trimmedContent || isSubmittingReply) return

      if (onAddReply && setIsSubmittingReply) {
        setIsSubmittingReply(true)
        try {
          await onAddReply(noteId, trimmedContent, false, null, replyingTo?.id || null)
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

  const handleReplyToReply = useCallback((parentReply: ThreadedReply) => {
    setReplyingTo(parentReply)
    // Scroll to reply form if needed
    setTimeout(() => {
      const form = document.getElementById("threaded-reply-form")
      if (form) {
        form.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 100)
  }, [])

  const handleCancelReplyTo = useCallback(() => {
    setReplyingTo(null)
  }, [])

  const handleSubmitInlineReply = useCallback(
    async (content: string, parentReplyId: string) => {
      if (!onAddReply || !content.trim()) return

      try {
        await onAddReply(noteId, content.trim(), false, null, parentReplyId)
        // The reply will be added via the parent component's state update
      } catch (error) {
        console.error("Error submitting inline reply:", error)
        throw error
      }
    },
    [onAddReply, noteId]
  )

  const handleGenerateSummary = useCallback(
    async (tone: string) => {
      if (localReplies.length === 0 || isGeneratingSummary || !onGenerateSummary) return
      onGenerateSummary(tone)
    },
    [localReplies, isGeneratingSummary, onGenerateSummary],
  )

  const handleDeleteReply = useCallback(
    async (replyId: string) => {
      if (!onDeleteReply) return

      try {
        await onDeleteReply(noteId, replyId)
        // Remove reply and any nested replies from local state
        const removeReply = (replies: ThreadedReply[]): ThreadedReply[] => {
          return replies
            .filter(r => r.id !== replyId)
            .map(r => ({
              ...r,
              replies: r.replies ? removeReply(r.replies) : []
            }))
        }
        setLocalReplies(prev => removeReply(prev))
      } catch (error) {
        console.error("Error deleting reply:", error)
      }
    },
    [onDeleteReply, noteId],
  )

  const handleEditReply = useCallback(
    async (replyId: string, content: string) => {
      if (!onEditReply) return

      try {
        await onEditReply(noteId, replyId, content)
        // Update local state
        const updateReply = (replies: ThreadedReply[]): ThreadedReply[] => {
          return replies.map(r => {
            if (r.id === replyId) {
              return { ...r, content, updated_at: new Date().toISOString() }
            }
            if (r.replies && r.replies.length > 0) {
              return { ...r, replies: updateReply(r.replies) }
            }
            return r
          })
        }
        setLocalReplies(prev => updateReply(prev))
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
      }
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

        const updateCalStick = (replies: ThreadedReply[]): ThreadedReply[] => {
          return replies.map(r => {
            if (r.id === replyId) {
              return {
                ...r,
                is_calstick: false,
                calstick_date: null,
                calstick_completed: false,
                calstick_completed_at: null,
              }
            }
            if (r.replies && r.replies.length > 0) {
              return { ...r, replies: updateCalStick(r.replies) }
            }
            return r
          })
        }
        setLocalReplies(prev => updateCalStick(prev))

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

        const updateCalStick = (replies: ThreadedReply[]): ThreadedReply[] => {
          return replies.map(r => {
            if (r.id === replyId) {
              return { ...r, is_calstick: true, calstick_date: date }
            }
            if (r.replies && r.replies.length > 0) {
              return { ...r, replies: updateCalStick(r.replies) }
            }
            return r
          })
        }
        setLocalReplies(prev => updateCalStick(prev))

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

      const updateCalStick = (replies: ThreadedReply[]): ThreadedReply[] => {
        return replies.map(r => {
          if (r.id === replyId) {
            return {
              ...r,
              calstick_completed: newCompleted,
              calstick_completed_at: newCompleted ? new Date().toISOString() : null,
            }
          }
          if (r.replies && r.replies.length > 0) {
            return { ...r, replies: updateCalStick(r.replies) }
          }
          return r
        })
      }
      setLocalReplies(prev => updateCalStick(prev))

      toast.success(newCompleted ? "Task completed!" : "Task marked incomplete")
    } catch (error) {
      console.error("Error toggling completion:", error)
      toast.error("Failed to update task")
    }
  }, [])

  const getDisplayName = useCallback((r: ThreadedReply) => getReplyDisplayName(r), [])

  if (isNewNote) return null

  const isCompactLayout = context === "card" || context === "panel" || (context === "stick" && showReplyForm)

  if (isCompactLayout) {
    return (
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          {totalReplyCount > 0 && enableFullscreenButton && onOpenFullscreen && (
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
              {totalReplyCount} {totalReplyCount === 1 ? "Reply" : "Replies"}
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

  const renderHeader = () => (
    <div className="p-4 border-b flex-shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Replies ({totalReplyCount})
          {enableThreading && threadedReplies.length > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              {threadedReplies.length} thread{threadedReplies.length === 1 ? "" : "s"}
            </span>
          )}
        </h3>
        {localReplies.length > 0 ? (
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
                <DropdownMenuContent align="end" className="z-[9999] bg-white border shadow-lg">
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
                <DropdownMenuContent align="end" className="z-[9999] bg-white border shadow-lg">
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
        <div className="space-y-3 mb-4">
          {threadedReplies.map((reply) => (
            <ThreadedReplyItem
              key={reply.id}
              reply={reply}
              depth={0}
              context={context}
              supportsCalStick={supportsCalStick}
              editingCalStick={editingCalStick}
              calStickDate={calStickDates[reply.id] || ""}
              currentUserId={currentUserId}
              onDelete={onDeleteReply ? handleDeleteReply : undefined}
              onEdit={onEditReply ? handleEditReply : undefined}
              onReply={enableThreading ? handleReplyToReply : undefined}
              onSubmitInlineReply={enableThreading && onAddReply ? handleSubmitInlineReply : undefined}
              onToggleCalStick={handleToggleCalStick}
              onCalStickDateChange={handleCalStickDateChange}
              onSaveCalStickDate={handleSaveCalStickDate}
              onCancelCalStickEdit={() => setEditingCalStick(null)}
              onToggleCalStickComplete={handleToggleCalStickComplete}
            />
          ))}
        </div>
      )}

      {threadedReplies.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No replies yet</p>}
    </>
  )

  if (context === "fullscreen" || context === "stick") {
    return (
      <div className="bg-white rounded-lg shadow-md border h-full flex flex-col">
        {renderHeader()}

        {canEdit && !isNewNote && (
          <div id="threaded-reply-form" className="p-4 border-b bg-white flex-shrink-0">
            {/* Replying to indicator */}
            {replyingTo && (
              <div className="mb-2 flex items-center justify-between bg-blue-50 rounded-lg p-2 border border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <MessageSquare className="h-4 w-4" />
                  <span>Replying to <strong>@{getDisplayName(replyingTo)}</strong></span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelReplyTo}
                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                >
                  <X className="h-4 w-4" />
                </Button>
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

        <div className="p-4 flex-1 overflow-y-auto text-gray-900">{renderReplies()}</div>
      </div>
    )
  }

  return (
    <div className="w-full lg:w-1/2 lg:flex-shrink-0 mt-6 lg:mt-0">
      <div className="bg-white rounded-lg shadow-md border h-fit">
        {renderHeader()}
        <div className="p-4 max-h-[600px] overflow-y-auto text-gray-900">{renderReplies()}</div>
      </div>
    </div>
  )
}

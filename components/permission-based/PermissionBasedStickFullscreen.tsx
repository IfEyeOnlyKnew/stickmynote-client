"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { X, Trash2, Zap, MessagesSquare, Video } from "lucide-react"
import { GenericStickTabs } from "@/components/GenericStickTabs"
import { ThreadedReplies } from "@/components/replies/ThreadedReplies"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import { NotedIcon } from "@/components/noted/NotedIcon"
import { PublishAsPageButton } from "@/components/hosted/PublishAsPageButton"
import type { Stick } from "@/types/pad"
import type { StickTabsConfig } from "@/types/stick-tabs-config"
import { getStickTabs, saveStickTab, deleteStickTabItem } from "@/lib/stick-tabs"
import { useToast } from "@/hooks/use-toast"

interface ExtendedStick extends Omit<Stick, "topic"> {
  topic: string
  tags?: string[]
  hyperlinks?: Array<{ url: string; title: string }>
}

interface StickPermissions {
  canView: boolean
  canEdit: boolean
  canAdmin: boolean
}

interface PermissionBasedStickFullscreenProps {
  stick: Stick
  permissions: StickPermissions
  onClose: () => void
  onUpdate?: (stick: Stick) => void
  onDelete?: (stickId: string) => void
  stickType?: "personal" | "concur" | "alliance" | "inference"
}

interface Tone {
  value: string
  label: string
}

export function PermissionBasedStickFullscreen({
  stick,
  permissions,
  onClose,
  onUpdate,
  onDelete,
  stickType,
}: Readonly<PermissionBasedStickFullscreenProps>) {
  const [editedStick, setEditedStick] = useState<ExtendedStick>({
    ...stick,
    topic: stick.topic || "",
    tags: [],
  })
  const [replies, setReplies] = useState<any[]>([])
  const [isGeneratingTags, setIsGeneratingTags] = useState(false)
  const [isSummarizingLinks, setIsSummarizingLinks] = useState(false)

  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [originalTopic, setOriginalTopic] = useState(stick.topic || "")
  const [originalContent, setOriginalContent] = useState(stick.content || "")

  const [replyContent, setReplyContent] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [replySummary, setReplySummary] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState("professional")
  const [replyCount, setReplyCount] = useState(0)
  const [isExporting] = useState(false)

  const [isQuickStick, setIsQuickStick] = useState(stick.is_quickstick || false)

  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [chatModalOpen, setChatModalOpen] = useState(false)

  // Real-time polling for replies
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastReplyIdsRef = useRef<string>("")

  const tones: Tone[] = [
    { value: "professional", label: "Professional" },
    { value: "casual", label: "Casual" },
    { value: "friendly", label: "Friendly" },
    { value: "formal", label: "Formal" },
  ]

  const { toast } = useToast()

  useEffect(() => {
    setEditedStick((prev) => ({
      ...prev,
      ...stick,
      topic: stick.topic || "",
    }))
    setIsQuickStick(stick.is_quickstick || false)
  }, [stick])

  // Load replies with polling for real-time updates
  useEffect(() => {
    const loadReplies = async (isPolling = false) => {
      try {
        const timestamp = Date.now()
        const response = await fetch(`/api/sticks/${stick.id}/replies?t=${timestamp}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        })
        if (response.ok) {
          const data = await response.json()
          const newReplies = data.replies || []

          // Create a hash of reply IDs to detect changes
          const newReplyIds = newReplies.map((r: { id: string }) => r.id).join(",")
          const hasChanges = newReplyIds !== lastReplyIdsRef.current

          if (!isPolling || hasChanges) {
            setReplies(newReplies)
            setReplyCount(newReplies.length)
            lastReplyIdsRef.current = newReplyIds
          }
        }
      } catch (error) {
        console.error("Error loading stick replies:", error)
      }
    }

    if (permissions.canView) {
      // Initial load
      loadReplies(false)

      // Set up polling every 5 seconds for real-time updates
      pollingIntervalRef.current = setInterval(() => {
        loadReplies(true)
      }, 5000)
    }

    // Cleanup polling on unmount or when stick changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [stick.id, permissions.canView, refreshTrigger])

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const data = await response.json()
          setCurrentUserId(data.user?.id || null)
        }
      } catch (error) {
        console.error("Error fetching current user:", error)
      }
    }
    fetchCurrentUser()
  }, [])

  const handleStickUpdate = async (updates: Partial<ExtendedStick>, showToast = true) => {
    if (!permissions.canEdit) return

    try {
      const response = await fetch(`/api/sticks/${stick.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        onUpdate?.(data.stick)
        setEditedStick((prev) => ({
          ...prev,
          ...data.stick,
          topic: data.stick.topic || "",
        }))

        if (showToast) {
          let updateType = "Stick"
          if (updates.topic !== undefined) updateType = "Topic"
          else if (updates.content !== undefined) updateType = "Content"
          toast({
            title: `${updateType} Saved`,
            description: `Your ${updateType.toLowerCase()} has been updated successfully.`,
            variant: "default",
          })
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Failed to Save",
          description: errorData.error || "An error occurred while saving.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating stick:", error)
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleTopicFocus = () => {
    setIsEditingTopic(true)
    setOriginalTopic(editedStick.topic)
  }

  const handleContentFocus = () => {
    setIsEditingContent(true)
    setOriginalContent(editedStick.content)
  }

  const handleCancelTopic = () => {
    setIsEditingTopic(false)
    setEditedStick((prev) => ({ ...prev, topic: originalTopic }))
  }

  const handleCancelContent = () => {
    setIsEditingContent(false)
    setEditedStick((prev) => ({ ...prev, content: originalContent }))
  }

  const handleStickTopic = () => {
    setIsEditingTopic(false)
    setOriginalTopic(editedStick.topic)
    handleStickUpdate({ topic: editedStick.topic })
  }

  const handleStickContent = () => {
    setIsEditingContent(false)
    setOriginalContent(editedStick.content)
    handleStickUpdate({ content: editedStick.content })
  }

  const handleGenerateTags = async () => {
    if (!permissions.canEdit) return

    setIsGeneratingTags(true)
    try {
      const response = await fetch(`/api/sticks/${stick.id}/generate-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: editedStick.topic,
          content: editedStick.content,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        setEditedStick((prev) => ({
          ...prev,
          tags: data.tags,
          hyperlinks: data.hyperlinks,
        }))

        globalThis.dispatchEvent(new CustomEvent("refreshStickTabs"))

        toast({
          title: "Tags Generated",
          description: `Generated ${data.tags?.length || 0} tags and ${data.hyperlinks?.length || 0} links.`,
          variant: "default",
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Failed to Generate Tags",
          description: errorData.error || "An error occurred while generating tags.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tags. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingTags(false)
    }
  }

  const handleSummarizeLinks = async () => {
    if (!permissions.canEdit) return

    setIsSummarizingLinks(true)
    try {
      const response = await fetch(`/api/sticks/${stick.id}/summarize-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()

        globalThis.dispatchEvent(new CustomEvent("refreshStickTabs"))

        toast({
          title: "Links Summarized",
          description: data.message || `Summarized ${data.summaryCount} of ${data.totalLinks} links. Check the Details tab.`,
          variant: "default",
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Failed to Summarize Links",
          description: errorData.error || "An error occurred while summarizing links.",
          variant: "destructive",
        })
      }
    } catch {
      // Expected - summarize request may fail
      toast({
        title: "Error",
        description: "Failed to summarize links. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSummarizingLinks(false)
    }
  }

  const handleAddReply = async (stickId: string, content: string, isCalStick: boolean, calStickDate: string | null, parentReplyId?: string | null) => {
    if (!permissions.canEdit || !content.trim()) return

    try {
      const response = await fetch(`/api/sticks/${stickId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          is_calstick: isCalStick,
          calstick_date: calStickDate,
          parent_reply_id: parentReplyId || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        setReplies((prev) => [...prev, data.reply])
        setReplyCount((prev) => prev + 1)

        setRefreshTrigger((prev) => prev + 1)

        if (onUpdate) {
          const stickResponse = await fetch(`/api/sticks/${stickId}`)
          if (stickResponse.ok) {
            const stickData = await stickResponse.json()
            onUpdate(stickData.stick)
          }
        }

        toast({
          title: "Reply Added",
          description: isCalStick
            ? "Your CalStick task has been added successfully."
            : "Your reply has been added successfully.",
          variant: "default",
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("Error submitting reply:", errorData.error)
        throw new Error(errorData.error || "Failed to create reply")
      }
    } catch (error) {
      console.error("Error submitting reply:", error)
      throw error
    }
  }

  const handleDeleteStick = async () => {
    if (!permissions.canAdmin) return

    try {
      const response = await fetch(`/api/sticks/${stick.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        onDelete?.(stick.id)
        onClose()
      }
    } catch (error) {
      console.error("Error deleting stick:", error)
    }
  }

  const handleDeleteReply = async (stickId: string, replyId: string) => {
    try {
      const response = await fetch(`/api/sticks/${stickId}/replies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId }),
      })

      if (response.ok) {
        setReplies((prev) => prev.filter((reply) => reply.id !== replyId))
        setReplyCount((prev) => prev - 1)

        setRefreshTrigger((prev) => prev + 1)

        if (onUpdate) {
          const stickResponse = await fetch(`/api/sticks/${stickId}`)
          if (stickResponse.ok) {
            const stickData = await stickResponse.json()
            onUpdate(stickData.stick)
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Failed to Delete Reply",
          description: errorData.error || "An error occurred while deleting the reply.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting reply:", error)
      throw error
    }
  }

  const handleEditReply = async (stickId: string, replyId: string, content: string) => {
    try {
      const response = await fetch(`/api/sticks/${stickId}/replies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId, content }),
      })

      if (response.ok) {
        const { reply: updatedReply } = await response.json()
        setReplies((prev) => prev.map((reply) => (reply.id === replyId ? { ...reply, ...updatedReply } : reply)))

        if (onUpdate) {
          const stickResponse = await fetch(`/api/sticks/${stickId}`)
          if (stickResponse.ok) {
            const stickData = await stickResponse.json()
            onUpdate(stickData.stick)
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Failed to Edit Reply",
          description: errorData.error || "An error occurred while editing the reply.",
          variant: "destructive",
        })
        throw new Error(errorData.error)
      }
    } catch (error) {
      console.error("Error editing reply:", error)
      throw error
    }
  }

  const handleGenerateSummary = async (tone: string) => {
    if (!permissions.canEdit && !permissions.canAdmin) return

    setIsGeneratingSummary(true)
    setSelectedTone(tone)

    try {
      const response = await fetch(`/api/sticks/${stick.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      })

      if (response.ok) {
        const data = await response.json()

        setReplySummary(
          `Summary generated and exported as ${data.filename}. Check the Details tab for the download link.`,
        )

        globalThis.dispatchEvent(new CustomEvent("refreshStickTabs"))

        toast({
          title: "Summary Generated!",
          description: "Your summary has been created and is available in the Details tab.",
          variant: "default",
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Summary Failed",
          description: errorData.error || "Failed to generate summary. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error generating summary:", error)
      setReplySummary("Failed to generate summary. Please try again.")

      toast({
        title: "Summary Failed",
        description: "An error occurred while generating summary. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const renderMetadata = useCallback(() => {
    return (
      <>
        {editedStick.tags && editedStick.tags.length > 0 && (
          <div className="mb-3 mt-3">
            <div className="flex flex-wrap gap-1">
              {editedStick.tags.map((tag: string, index: number) => (
                <Badge key={`${editedStick.id}-tag-${tag}-${index}`} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }, [editedStick.tags, editedStick.id])

  const stickTabsConfig: StickTabsConfig = {
    getStickTabs,
    saveStickTab,
    deleteStickTabItem,
    idFieldName: "stick_id",
    supportsExportDeletion: true,
    isStick: true,
    globalRefreshFunctionName: "refreshStickTabs",
  }

  const handleQuickStickToggle = async (checked: boolean) => {
    if (!permissions.canEdit) return

    setIsQuickStick(checked)

    try {
      const response = await fetch(`/api/sticks/${stick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_quickstick: checked }),
      })

      if (response.ok) {
        const data = await response.json()
        onUpdate?.(data.stick)
        toast({
          title: checked ? "Added to QuickSticks" : "Removed from QuickSticks",
          description: checked
            ? "This stick is now available in QuickSticks for quick access."
            : "This stick has been removed from QuickSticks.",
          variant: "default",
        })
      } else {
        console.error("Failed to update QuickStick status")
        setIsQuickStick(!checked) // Revert on error
      }
    } catch (error) {
      console.error("Error updating QuickStick status:", error)
      setIsQuickStick(!checked) // Revert on error
    }
  }

  const handleDetailsChange = async (details: string) => {
    await handleStickUpdate({ details }, false) // Don't show toast for auto-saved details
    globalThis.dispatchEvent(new CustomEvent("refreshStickTabs"))
  }

  return (
    <dialog
      open
      className="fixed inset-0 bg-black/50 z-50 overflow-hidden m-0 p-0 border-none max-w-none max-h-none w-full h-full"
      aria-modal="true"
    >
      <div className="h-full w-full flex flex-col lg:flex-row lg:gap-4 lg:p-4 overflow-hidden p-2 gap-2">
        <div className="w-full min-w-0 lg:w-1/2 rounded-lg shadow-md border overflow-hidden flex-1 lg:flex-none lg:h-full flex flex-col bg-white min-h-0">
          <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-white/80 border-b flex-shrink-0 overflow-hidden min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {permissions.canAdmin && "Admin"}
                {!permissions.canAdmin && permissions.canEdit && "Edit"}
                {!permissions.canAdmin && !permissions.canEdit && "View"}
              </Badge>
              {permissions.canEdit && (
                <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2 min-w-0" aria-hidden="true" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Checkbox
                    id="quickstick"
                    checked={isQuickStick}
                    onCheckedChange={handleQuickStickToggle}
                    className="h-4 w-4 flex-shrink-0"
                  />
                  <Label htmlFor="quickstick" className="text-xs font-medium cursor-pointer flex items-center gap-1 flex-shrink-0">
                    <Zap className="h-3 w-3 text-yellow-600" />
                    <span className="hidden sm:inline">QuickStick</span>
                  </Label>
                  <NotedIcon
                    stickId={stick.id}
                    stickTopic={editedStick.topic}
                    stickContent={editedStick.content}
                    isPersonal={stickType === "personal"}
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                    openInNewTab
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                    title="Start chat for this stick"
                    onClick={() => setChatModalOpen(true)}
                  >
                    <MessagesSquare className="h-4 w-4 text-purple-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                    title="Start video call"
                    onClick={() => window.open("/video", "_blank", "noopener,noreferrer")}
                  >
                    <Video className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <PublishAsPageButton stickId={stick.id} kind="pad" />
              {permissions.canAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" title="Delete stick">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this stick and all its content,
                        including replies, media, and tags.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteStick}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Stick
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} title="Close fullscreen">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-2 sm:p-4 md:p-6 bg-white text-gray-900 flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full min-w-0">
            <GenericStickTabs
              stickId={editedStick.id}
              initialTopic={editedStick.topic}
              initialContent={editedStick.content}
              initialDetails={editedStick.details || ""}
              onTopicChange={(topic: string) => setEditedStick((prev) => ({ ...prev, topic }))}
              onContentChange={(content: string) => setEditedStick((prev) => ({ ...prev, content }))}
              onDetailsChange={handleDetailsChange}
              onTopicFocus={handleTopicFocus}
              onContentFocus={handleContentFocus}
              readOnly={!permissions.canEdit}
              showMedia={true}
              config={stickTabsConfig}
              isEditingTopic={isEditingTopic}
              isEditingContent={isEditingContent}
              onCancelTopic={handleCancelTopic}
              onCancelContent={handleCancelContent}
              onStickTopic={handleStickTopic}
              onStickContent={handleStickContent}
              onGenerateTags={handleGenerateTags}
              isGeneratingTags={isGeneratingTags}
              onSummarizeLinks={handleSummarizeLinks}
              isSummarizingLinks={isSummarizingLinks}
              stickType={stickType}
            />

            {renderMetadata()}
          </div>
        </div>

        {permissions.canView && (
          <div className="w-full lg:w-1/2 lg:mb-0 flex-1 lg:flex-none lg:h-full overflow-hidden min-h-0">
            <ThreadedReplies
              noteId={editedStick.id}
              context="stick"
              replies={replies}
              replyCount={replyCount}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              isSubmittingReply={isSubmittingReply}
              setIsSubmittingReply={setIsSubmittingReply}
              isGeneratingSummary={isGeneratingSummary}
              replySummary={replySummary}
              selectedTone={selectedTone}
              setSelectedTone={setSelectedTone}
              tones={tones}
              onAddReply={handleAddReply}
              onDeleteReply={handleDeleteReply}
              onEditReply={handleEditReply}
              canEdit={permissions.canEdit || permissions.canAdmin}
              isNewNote={false}
              enableSummary={true}
              enableExport={false}
              enableThreading={true}
              isExporting={isExporting}
              onGenerateSummary={handleGenerateSummary}
              currentUserId={currentUserId}
            />
          </div>
        )}
      </div>

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={editedStick.topic || "Untitled Stick"}
        autoSubmit
        stickId={stick.id}
        stickType="pad"
        openInNewTab
      />
    </dialog>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
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
import { X, Trash2, Zap } from "lucide-react"
import { GenericStickTabs } from "@/components/GenericStickTabs"
import { ThreadedReplies } from "@/components/replies/ThreadedReplies"
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
}: PermissionBasedStickFullscreenProps) {
  const [editedStick, setEditedStick] = useState<ExtendedStick>({
    ...stick,
    topic: stick.topic || "",
    tags: [],
  })
  const [replies, setReplies] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
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
  const [isExporting, setIsExporting] = useState(false)

  const [isQuickStick, setIsQuickStick] = useState(stick.is_quickstick || false)

  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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

  useEffect(() => {
    const loadReplies = async () => {
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
          setReplies(data.replies || [])
          setReplyCount(data.replies?.length || 0)
        }
      } catch (error) {
        console.error("Error loading stick replies:", error)
      }
    }

    if (permissions.canView) {
      loadReplies()
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
          const updateType = updates.topic !== undefined ? "Topic" : updates.content !== undefined ? "Content" : "Stick"
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

        window.dispatchEvent(new CustomEvent("refreshStickTabs"))

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

        window.dispatchEvent(new CustomEvent("refreshStickTabs"))

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
    } catch (error) {
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

  const handleExportAll = async () => {
    if (!permissions.canEdit && !permissions.canAdmin) return

    setIsExporting(true)

    try {
      const response = await fetch(`/api/sticks/${stick.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone }),
      })

      if (response.ok) {
        const data = await response.json()

        window.dispatchEvent(new CustomEvent("refreshStickTabs"))

        toast({
          title: "Export Complete!",
          description: "Your stick export has been generated and is available in the Details tab.",
          variant: "default",
        })

        console.log("Export file available at:", data.exportUrl)
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        toast({
          title: "Export Failed",
          description: errorData.error || "Failed to export stick. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error exporting stick:", error)

      toast({
        title: "Export Failed",
        description: "An error occurred while exporting. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
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

        window.dispatchEvent(new CustomEvent("refreshStickTabs"))

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
    window.dispatchEvent(new CustomEvent("refreshStickTabs"))
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full h-[calc(100vh-4rem)] flex flex-col lg:flex-row lg:gap-6 lg:items-start">
        <div className="w-full lg:w-1/2 lg:flex-shrink-0 rounded-lg shadow-md border overflow-hidden mt-6 lg:mt-0 lg:h-full lg:flex lg:flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white/80 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {permissions.canAdmin && "Admin"}
                {!permissions.canAdmin && permissions.canEdit && "Edit"}
                {!permissions.canAdmin && !permissions.canEdit && "View"}
              </Badge>
              {permissions.canEdit && (
                <div className="flex items-center gap-2 ml-2" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Checkbox
                    id="quickstick"
                    checked={isQuickStick}
                    onCheckedChange={handleQuickStickToggle}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="quickstick" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-600" />
                    QuickStick
                  </Label>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
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

          <div className="p-4 md:p-6 bg-white text-gray-900 flex-1 overflow-y-auto">
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
            />

            {renderMetadata()}
          </div>
        </div>

        {permissions.canView && (
          <div className="w-full lg:w-1/2 lg:flex-shrink-0 mt-6 lg:mt-0 lg:h-full">
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
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useUser } from "@/contexts/user-context"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Calendar, Filter, MessageSquare, BookOpen, LinkIcon, Trash2, LayoutList, Clock, ChevronLeft, ChevronRight, Lightbulb, Play, CheckCircle2, FolderOpen } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ReplyModal, REPLY_CATEGORIES } from "@/components/inference/reply-modal"
import { Badge } from "@/components/ui/badge"
import { ReplyCard } from "@/components/inference/reply-card"
import { DiscussionTemplatePicker } from "@/components/inference/discussion-template-picker"
import { DiscussionTemplateProgress } from "@/components/inference/discussion-template-progress"
import { GuidedPromptsPanel } from "@/components/inference/guided-prompts-panel"
import type { DiscussionTemplate, TemplateProgress, StickDiscussionTemplate } from "@/types/discussion-templates"
import { InferenceStickTabs } from "@/components/inference/inference-stick-tabs"
import { KnowledgeBaseDrawer } from "@/components/inference/knowledge-base-drawer"
import { AddCitationModal } from "@/components/inference/add-citation-modal"
import { StickSummaryCard } from "@/components/inference/stick-summary-card"
import { RelatedKBArticles } from "@/components/inference/related-kb-articles"
import { FollowButton } from "@/components/inference/follow-button"
import { LibraryDialog } from "@/components/library/LibraryDialog"
import { toast } from "sonner"
import { WORKFLOW_STATUSES, WORKFLOW_ORDER, type WorkflowStatus } from "@/types/inference-workflow"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PublishAsPageButton } from "@/components/hosted/PublishAsPageButton"

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

interface InferenceStick {
  id: string
  topic: string
  content: string
  color: string
  created_at: string
  user_id: string
  social_pad_id: string
  users?: {
    id: string
    full_name: string | null
    email: string
  }
  replies?: Reply[]
  details?: string
  live_summary?: string
  action_items?: Array<{ title: string; owner: string; status: string; due_hint?: string }>
  suggested_questions?: string[]
  last_summarized_at?: string
  summary_reply_count?: number
  ai_generated_tags?: string[]
  // Workflow fields
  workflow_status?: WorkflowStatus
  workflow_owner_id?: string | null
  workflow_due_date?: string | null
  workflow_owner?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

interface StickDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  onUpdate?: () => void
}

function getWorkflowStepColor(isCurrent: boolean, isPast: boolean, currentColor: string, pastColor: string, defaultColor: string): string {
  if (isCurrent) return currentColor
  if (isPast) return pastColor
  return defaultColor
}

// Recursively update a reply by id within a nested reply tree
function updateReplyInTree(replies: Reply[], replyId: string, transform: (reply: Reply) => Reply): Reply[] {
  return replies.map((reply) => {
    if (reply.id === replyId) return transform(reply)
    if (reply.replies?.length) return { ...reply, replies: updateReplyInTree(reply.replies, replyId, transform) }
    return reply
  })
}

export function StickDetailModal({ open, onOpenChange, stickId, onUpdate }: Readonly<StickDetailModalProps>) {
  const { user } = useUser()
  const [stick, setStick] = useState<InferenceStick | null>(null)
  const [loading, setLoading] = useState(false)
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [parentReply, setParentReply] = useState<Reply | null>(null)
  const [isPadOwner, setIsPadOwner] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(REPLY_CATEGORIES.map((c) => c.value))

  const [isEditing, setIsEditing] = useState(false)
  const [tempTopic, setTempTopic] = useState("")
  const [tempContent, setTempContent] = useState("")
  const [currentTopic, setCurrentTopic] = useState("")
  const [currentContent, setCurrentContent] = useState("")

  const [showKBDrawer, setShowKBDrawer] = useState(false)
  const [showCitationModal, setShowCitationModal] = useState(false)
  const [showFilesDialog, setShowFilesDialog] = useState(false)
  const [citations, setCitations] = useState<any[]>([])
  const [padId, setPadId] = useState<string>("")

  const [isSummarizing, setIsSummarizing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grouped' | 'timeline'>('grouped')

  // Discussion template state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateAssignment, setTemplateAssignment] = useState<StickDiscussionTemplate | null>(null)
  const [templateProgress, setTemplateProgress] = useState<TemplateProgress | null>(null)
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null)

  // Category tabs scroll ref
  const categoryTabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id)
    }
  }, [user])

  const selectOnlyCategory = (category: string) => {
    setSelectedCategories([category])
  }

  const resetCategories = () => {
    setSelectedCategories(REPLY_CATEGORIES.map((c) => c.value))
  }

  const fetchWithRetry = async (url: string, options?: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)

        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = response.headers.get("Retry-After")
          const waitTime = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000
          console.log(`[v0] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
          continue
        }

        return response
      } catch (error) {
        lastError = error as Error
        // Network error - wait and retry
        const waitTime = Math.pow(2, attempt) * 500
        console.log(`[v0] Network error, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    throw lastError || new Error("Max retries exceeded")
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && stickId) {
      fetchStick()
    }
  }, [open, stickId])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (stick) {
      setCurrentTopic(stick.topic)
      setCurrentContent(stick.content)
      setTempTopic(stick.topic)
      setTempContent(stick.content)
    }
  }, [stick])

  const fetchPadMemberRole = async (padId: string): Promise<void> => {
    try {
      const memberResponse = await fetchWithRetry(`/api/inference-pads/${padId}/members`)
      const contentType = memberResponse.headers.get("content-type")
      
      if (!contentType?.includes("application/json")) {
        const text = await memberResponse.text()
        console.error("[v0] Non-JSON response from members API:", text.substring(0, 100))
        return
      }
      
      if (!memberResponse.ok) {
        console.error("[v0] Failed to fetch members:", memberResponse.status)
        return
      }
      
      const memberData = await memberResponse.json()
      const userMembership = memberData.members?.find((m: any) => m.user_id === user?.id)
      setIsAdmin(userMembership?.role === "admin")
    } catch (memberError) {
      console.error("[v0] Error fetching members:", memberError)
    }
  }

  const fetchPadOwnership = async (padId: string): Promise<void> => {
    const padResponse = await fetchWithRetry(`/api/inference-pads/${padId}`)
    if (padResponse.ok) {
      const padData = await padResponse.json()
      setIsPadOwner(padData.pad.owner_id === user?.id)
      await fetchPadMemberRole(padId)
    }
  }

  const fetchStick = async () => {
    try {
      setLoading(true)
      const response = await fetchWithRetry(`/api/inference-sticks/${stickId}`)
      if (!response.ok) return

      const data = await response.json()
      setStick(data.stick)

      if (user && data.stick.social_pad_id) {
        await fetchPadOwnership(data.stick.social_pad_id)
      }
    } catch (error) {
      console.error("[v0] Error fetching stick:", error)
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (stick?.social_pad_id) {
      setPadId(stick.social_pad_id)
      fetchCitations()
      fetchDiscussionTemplate()
    }
  }, [stick])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchCitations = async () => {
    if (!stickId) return
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/citations`)
      if (response.ok) {
        const data = await response.json()
        setCitations(data.citations || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching citations:", error)
    }
  }

  const fetchDiscussionTemplate = useCallback(async () => {
    if (!stickId) return
    try {
      const response = await fetch(`/api/v2/inference-sticks/${stickId}/discussion-template`)
      if (response.ok) {
        const data = await response.json()
        setTemplateAssignment(data.assignment)
        setTemplateProgress(data.progress)
      }
    } catch (error) {
      console.error("[v0] Error fetching discussion template:", error)
    }
  }, [stickId])

  const handleAssignTemplate = async (template: DiscussionTemplate) => {
    if (!stickId) return
    try {
      const response = await fetch(`/api/v2/inference-sticks/${stickId}/discussion-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      })
      if (response.ok) {
        await fetchDiscussionTemplate()
        toast.success(`Applied "${template.name}" template`)
      }
    } catch (error) {
      console.error("[v0] Error assigning template:", error)
      toast.error("Failed to apply template")
    }
  }

  const handleRemoveTemplate = async () => {
    if (!stickId) return
    if (!confirm("Remove the discussion template from this stick?")) return
    try {
      const response = await fetch(`/api/v2/inference-sticks/${stickId}/discussion-template`, {
        method: "DELETE",
      })
      if (response.ok) {
        setTemplateAssignment(null)
        setTemplateProgress(null)
        toast.success("Template removed")
      }
    } catch (error) {
      console.error("[v0] Error removing template:", error)
      toast.error("Failed to remove template")
    }
  }

  const handleGuidedPromptSelect = (category: string) => {
    setSuggestedCategory(category)
    setParentReply(null)
    setReplyModalOpen(true)
  }

  const handleDeleteCitation = async (citationId: string) => {
    if (!confirm("Remove this citation?")) return
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/citations?citationId=${citationId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setCitations(citations.filter((c) => c.id !== citationId))
      }
    } catch (error) {
      console.error("[v0] Error deleting citation:", error)
    }
  }

  const handleSubmitReply = async (content: string, category: string) => {
    if (!stick) return

    try {
      console.log(
        "[v0] Submitting reply to stick:",
        stickId,
        "parent:",
        parentReply?.id || "none",
        "category:",
        category,
      )
      const response = await fetch(`/api/inference-sticks/${stickId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          color: "#fef3c7",
          parent_reply_id: parentReply?.id || null,
          category,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Reply created successfully:", data.reply.id)

        const newReply: Reply = {
          ...data.reply,
          replies: [],
        }

        setStick((prev) => {
          if (!prev) return prev
          const updatedReplies = [...(prev.replies || []), newReply]
          return { ...prev, replies: updatedReplies }
        })

        setReplyModalOpen(false)
        setParentReply(null)
        setSuggestedCategory(null)

        // Refresh template progress after adding a reply
        if (templateAssignment) {
          fetchDiscussionTemplate()
        }

        if (stick.last_summarized_at) {
          handleRegenerateSummary()
        }

        onUpdate?.()
      } else {
        console.error("[v0] Failed to create reply:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error submitting reply:", error)
    }
  }


  const handleOpenReplyModal = useCallback((reply?: Reply) => {
    setParentReply(reply || null)
    setReplyModalOpen(true)
  }, [])

  const handleDeleteReply = useCallback(async (replyId: string) => {
    if (!confirm("Are you sure you want to delete this reply? This action cannot be undone.")) {
      return
    }

    try {
      console.log("[v0] Deleting reply:", replyId)
      const response = await fetch(`/api/inference-sticks/${stickId}/replies?replyId=${replyId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        console.log("[v0] Reply deleted successfully")
        await fetchStick()
        onUpdate?.()
      } else {
        console.error("[v0] Failed to delete reply:", response.status)
        alert("Failed to delete reply. Please try again.")
      }
    } catch (error) {
      console.error("[v0] Error deleting reply:", error)
      alert("An error occurred while deleting the reply.")
    }
  }, [stickId, onUpdate])

  const handleEditReply = useCallback(async (replyId: string, content: string) => {
    try {
      console.log("[v0] Editing reply:", replyId)
      const response = await fetch(`/api/inference-sticks/${stickId}/replies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_id: replyId, content }),
      })

      if (response.ok) {
        console.log("[v0] Reply edited successfully")

        // Find the reply to check if it has a calstick_id
        const findReply = (replies: Reply[]): Reply | undefined => {
          for (const reply of replies) {
            if (reply.id === replyId) return reply
            if (reply.replies?.length) {
              const found = findReply(reply.replies)
              if (found) return found
            }
          }
          return undefined
        }

        const editedReply = stick?.replies ? findReply(stick.replies) : undefined

        // If the reply has a linked CalStick, update it too
        if (editedReply?.calstick_id) {
          try {
            await fetch(`/api/calsticks/${editedReply.calstick_id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            })
            console.log("[v0] CalStick synced successfully")
          } catch (calstickError) {
            console.error("[v0] Error syncing CalStick:", calstickError)
            // Don't throw - reply was updated successfully
          }
        }

        // Update reply locally instead of refetching entire stick
        setStick((prev) => {
          if (!prev?.replies) return prev
          return { ...prev, replies: updateReplyInTree(prev.replies, replyId, (r) => ({ ...r, content, updated_at: new Date().toISOString() })) }
        })
        onUpdate?.()
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[v0] Failed to edit reply:", response.status, errorData)
        alert(errorData.error || "Failed to edit reply. Please try again.")
        throw new Error(errorData.error)
      }
    } catch (error) {
      console.error("[v0] Error editing reply:", error)
      throw error
    }
  }, [stickId, stick?.replies, onUpdate])

  const handleSyncFromCalStick = useCallback(async (replyId: string, calstickId: string) => {
    try {
      // Fetch the CalStick content
      const calstickResponse = await fetch(`/api/calsticks/${calstickId}`)
      if (!calstickResponse.ok) {
        throw new Error("Failed to fetch CalStick")
      }
      const calstickData = await calstickResponse.json()
      const newContent = calstickData.calstick.content

      // Update the reply with the CalStick content
      const response = await fetch(`/api/inference-sticks/${stickId}/replies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_id: replyId, content: newContent }),
      })

      if (response.ok) {
        // Update reply locally
        setStick((prev) => {
          if (!prev?.replies) return prev
          return { ...prev, replies: updateReplyInTree(prev.replies, replyId, (r) => ({ ...r, content: newContent, updated_at: new Date().toISOString() })) }
        })
        onUpdate?.()
      } else {
        throw new Error("Failed to sync reply")
      }
    } catch (error) {
      console.error("[v0] Error syncing from CalStick:", error)
      throw error
    }
  }, [stickId, onUpdate])

  const organizeReplies = (replies: Reply[]): Reply[] => {
    const replyMap = new Map<string, Reply>()
    const rootReplies: Reply[] = []

    replies.forEach((reply) => {
      replyMap.set(reply.id, { ...reply, replies: [] })
    })

    replies.forEach((reply) => {
      const replyWithChildren = replyMap.get(reply.id)!
      if (reply.parent_reply_id) {
        const parent = replyMap.get(reply.parent_reply_id)
        if (parent) {
          parent.replies = parent.replies || []
          parent.replies.push(replyWithChildren)
        } else {
          rootReplies.push(replyWithChildren)
        }
      } else {
        rootReplies.push(replyWithChildren)
      }
    })

    const sortReplies = (replies: Reply[]) => {
      replies.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      replies.forEach((reply) => {
        if (reply.replies && reply.replies.length > 0) {
          sortReplies(reply.replies)
        }
      })
    }

    sortReplies(rootReplies)
    return rootReplies
  }

  // Optimized: Only filter parent/root replies by category
  // Child replies are always shown if their parent matches
  const filterRepliesByCategory = useCallback((replies: Reply[]): Reply[] => {
    if (selectedCategories.length === REPLY_CATEGORIES.length) {
      // Fast path: all categories selected, no filtering needed
      return replies
    }

    // Create a Set for O(1) lookup instead of O(n) array.includes
    const categorySet = new Set(selectedCategories)

    return replies.filter((reply) => {
      const replyCategory = reply.category || "Default"
      return categorySet.has(replyCategory)
    })
  }, [selectedCategories])

  const groupRepliesByCategory = (replies: Reply[]) => {
    const grouped = new Map<string, Reply[]>()

    replies.forEach((reply) => {
      const category = reply.category || "Default"
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(reply)
    })

    return grouped
  }

  const handleFocus = () => {
    if (stick && stick.user_id === user?.id && !isEditing) {
      setIsEditing(true)
      setTempTopic(currentTopic)
      setTempContent(currentContent)
    }
  }

  const handleCancel = () => {
    setCurrentTopic(tempTopic)
    setCurrentContent(tempContent)
    setIsEditing(false)
  }

  const handleStick = async () => {
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentTopic,
          content: currentContent,
        }),
      })

      if (response.ok) {
        setStick((prev) => (prev ? { ...prev, topic: currentTopic, content: currentContent } : null))
        setTempTopic(currentTopic)
        setTempContent(currentContent)
        setIsEditing(false)
        onUpdate?.()
      }
    } catch (error) {
      console.error("Error updating stick:", error)
    }
  }

  const handleRegenerateSummary = useCallback(async () => {
    if (!stickId) return

    setIsSummarizing(true)
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/summarize`, {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setStick((prev) =>
          prev
            ? {
                ...prev,
                live_summary: data.summary,
                action_items: data.actionItems,
                suggested_questions: data.suggestedQuestions,
                last_summarized_at: new Date().toISOString(),
                summary_reply_count: data.replyCount,
              }
            : null,
        )
        toast.success(`Summary generated using ${data.provider || 'AI'}`)
      } else {
        // Show error message from API
        const errorMessage = data.error || "Failed to generate summary"
        toast.error(errorMessage)
        console.error("[Summarize] Error:", errorMessage)
      }
    } catch (error) {
      console.error("[Summarize] Network error:", error)
      toast.error("Network error. Please check your connection and try again.")
    } finally {
      setIsSummarizing(false)
    }
  }, [stickId])

  const handleInlineReply = useCallback(async (content: string, parentReplyId: string) => {
    if (!stick) return

    try {
      console.log("[v0] Submitting inline reply to parent:", parentReplyId)
      const response = await fetch(`/api/inference-sticks/${stickId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          color: "#fef3c7",
          parent_reply_id: parentReplyId,
          category: "comment", // Default category for inline replies
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Inline reply created successfully:", data.reply.id)

        // Refresh stick to get updated replies
        await fetchStick()

        if (stick.last_summarized_at) {
          handleRegenerateSummary()
        }

        onUpdate?.()
      } else {
        console.error("[v0] Failed to create inline reply:", response.status)
        throw new Error("Failed to create reply")
      }
    } catch (error) {
      console.error("[v0] Error submitting inline reply:", error)
      throw error
    }
  }, [stick, stickId, onUpdate, handleRegenerateSummary])

  const renderReply = useCallback((reply: Reply, depth = 0, parentAuthor?: string) => {
    if (!reply) return null

    return (
      <ReplyCard
        key={reply.id}
        reply={reply}
        depth={depth}
        currentUserId={currentUserId || undefined}
        isPadOwner={isPadOwner}
        isAdmin={isAdmin}
        parentAuthor={parentAuthor}
        onEdit={handleEditReply}
        onDelete={handleDeleteReply}
        onReply={handleOpenReplyModal}
        onSubmitReply={handleInlineReply}
        onSyncFromCalStick={handleSyncFromCalStick}
        renderNestedReply={renderReply}
      />
    )
  }, [currentUserId, isPadOwner, isAdmin, handleEditReply, handleDeleteReply, handleOpenReplyModal, handleInlineReply, handleSyncFromCalStick])

  const handleInsertQuestion = useCallback((_question: string) => {
    setParentReply(null)
    setReplyModalOpen(true)
  }, [])

  // Memoize computed values to prevent unnecessary re-renders
  const replyCount = useMemo(() => stick?.replies?.length || 0, [stick?.replies?.length])
  const showGenerateButton = useMemo(
    () => !stick?.live_summary && replyCount > 0,
    [stick?.live_summary, replyCount]
  )

  // Memoize StickSummaryCard props to prevent re-renders
  const summaryCardProps = useMemo(() => ({
    summary: stick?.live_summary,
    actionItems: stick?.action_items,
    suggestedQuestions: stick?.suggested_questions,
    lastSummarizedAt: stick?.last_summarized_at,
    summaryReplyCount: stick?.summary_reply_count,
  }), [
    stick?.live_summary,
    stick?.action_items,
    stick?.suggested_questions,
    stick?.last_summarized_at,
    stick?.summary_reply_count,
  ])

  // Memoize RelatedKBArticles props
  const stickTags = useMemo(() => stick?.ai_generated_tags || [], [stick?.ai_generated_tags])
  const stickContentForKB = useMemo(() => stick?.content || "", [stick?.content])
  const handleCiteArticle = useCallback(() => setShowCitationModal(true), [])

  const organizedReplies = useMemo(
    () => (stick?.replies ? organizeReplies(stick.replies) : []),
    [stick?.replies]
  )
  const filteredReplies = useMemo(
    () => filterRepliesByCategory(organizedReplies),
    [filterRepliesByCategory, organizedReplies]
  )
  const groupedReplies = useMemo(
    () => groupRepliesByCategory(filteredReplies),
    [filteredReplies]
  )

  // Get categories that have parent/root replies only (for highlighting in dropdown)
  // This matches the filtering behavior which only filters parent replies
  const categoriesWithReplies = useMemo(() => {
    const categories = new Set<string>()
    // Only check root-level replies (those without parent_reply_id)
    if (stick?.replies) {
      for (const reply of stick.replies) {
        if (!reply.parent_reply_id) {
          categories.add(reply.category || "Default")
        }
      }
    }
    return categories
  }, [stick?.replies])

  // Category counts for summary bar
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (stick?.replies) {
      for (const reply of stick.replies) {
        if (!reply.parent_reply_id) {
          const cat = reply.category || "Default"
          counts.set(cat, (counts.get(cat) || 0) + 1)
        }
      }
    }
    return counts
  }, [stick?.replies])

  // Sorted replies for timeline view (chronological order)
  const timelineSortedReplies = useMemo(() => {
    if (!stick?.replies) return []
    return [...stick.replies]
      .filter(r => !r.parent_reply_id) // Only root replies for timeline
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [stick?.replies])

  // Detect milestones for timeline view
  const getMilestone = useCallback((reply: Reply, index: number): { type: string; label: string } | null => {
    if (index === 0) return { type: 'first', label: 'First Reply' }
    if (reply.category === 'Answer') return { type: 'answer', label: 'Answer Posted' }
    if (reply.category === 'Status Update') return { type: 'status', label: 'Status Update' }
    if (reply.category === 'Correction') return { type: 'correction', label: 'Correction Made' }
    return null
  }, [])

  // Scroll category tabs
  const scrollCategoryTabs = useCallback((direction: 'left' | 'right') => {
    if (categoryTabsRef.current) {
      const scrollAmount = 200
      categoryTabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }, [])

  const isOwner = stick?.user_id === user?.id

  if (!stick && !loading) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-full sm:max-w-[95vw] md:max-w-[90vw] w-full p-0 h-[100dvh] sm:h-[95vh] sm:max-h-[95vh] flex flex-col rounded-none sm:rounded-lg top-0 sm:top-[2.5vh] translate-x-[-50%] translate-y-0"
        >
          <DialogTitle className="sr-only">Stick Details</DialogTitle>
          <DialogDescription className="sr-only">View and manage stick content, replies, and media</DialogDescription>

          <div className="p-4 sm:p-6 border-b border-gray-200 bg-white flex-shrink-0 sm:rounded-t-lg">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Stick Details</h2>
          </div>

          <div className="custom-scrollbar" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              )}
              {!loading && stick && (
                <div className="p-4 sm:p-6 pb-16 bg-gray-50">
                  <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                    <Card className="bg-white border-2 shadow-lg">
                      <CardHeader className="p-4 sm:p-6">
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg sm:text-xl md:text-2xl">Stick Content</CardTitle>
                            <div className="flex items-center gap-2">
                              <PublishAsPageButton
                                stickId={stick.id}
                                kind="pad"
                                canPublish={isOwner || isPadOwner || isAdmin}
                              />
                              <FollowButton
                                entityType="social_stick"
                                entityId={stick.id}
                                entityName={stick.topic}
                                variant="icon"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowKBDrawer(true)}
                              title="View knowledge base"
                              className="flex-1 sm:flex-none"
                            >
                              <BookOpen className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Knowledge Base</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowCitationModal(true)}
                              title="Add citation"
                              className="flex-1 sm:flex-none"
                            >
                              <LinkIcon className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Citation</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReplyModal()}
                              title="Reply to stick"
                              className="flex-1 sm:flex-none"
                            >
                              <MessageSquare className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Reply</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowFilesDialog(true)}
                              title="View files"
                              className="flex-1 sm:flex-none"
                            >
                              <FolderOpen className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Files</span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="overflow-hidden">
                        <InferenceStickTabs
                          noteId={stickId}
                          initialTopic={currentTopic}
                          initialContent={currentContent}
                          initialDetails={stick.details || ""}
                          onTopicChange={setCurrentTopic}
                          onContentChange={setCurrentContent}
                          onTopicFocus={handleFocus}
                          onContentFocus={handleFocus}
                          onDetailsChange={async (details: string) => {
                            try {
                              const response = await fetch(`/api/inference-stick-tabs`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ inferenceStickId: stickId, details }),
                              })

                              if (response.ok) {
                                setStick((prev) => (prev ? { ...prev, details } : null))
                                onUpdate?.()
                              }
                            } catch (error) {
                              console.error("Error updating details:", error)
                              throw error
                            }
                          }}
                          readOnly={!isOwner}
                          showMedia={true}
                          isEditing={isEditing}
                          onCancel={handleCancel}
                          onStick={handleStick}
                          stickType="inference"
                        />
                        <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {stick.users?.full_name || stick.users?.email || "Unknown"}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}
                          </div>
                        </div>

                        {citations.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <LinkIcon className="h-4 w-4" />
                              Citations & References ({citations.length})
                            </h4>
                            <div className="space-y-2">
                              {citations.map((citation: any) => (
                                <div
                                  key={citation.id}
                                  className="flex items-start justify-between p-2 bg-gray-50 rounded border"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {citation.citation_type}
                                      </Badge>
                                      <p className="text-sm font-medium">
                                        {citation.kb_article?.title || citation.external_title}
                                      </p>
                                    </div>
                                    {citation.citation_note && (
                                      <p className="text-xs text-gray-500 mt-1">{citation.citation_note}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-600"
                                    onClick={() => handleDeleteCitation(citation.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {padId && (
                      <RelatedKBArticles
                        padId={padId}
                        stickTags={stickTags}
                        stickContent={stickContentForKB}
                        onCiteArticle={handleCiteArticle}
                      />
                    )}

                    <StickSummaryCard
                      summary={summaryCardProps.summary}
                      actionItems={summaryCardProps.actionItems}
                      suggestedQuestions={summaryCardProps.suggestedQuestions}
                      lastSummarizedAt={summaryCardProps.lastSummarizedAt}
                      replyCount={replyCount}
                      summaryReplyCount={summaryCardProps.summaryReplyCount}
                      onRegenerateSummary={handleRegenerateSummary}
                      onInsertQuestion={handleInsertQuestion}
                      isLoading={isSummarizing}
                      showGenerateButton={showGenerateButton}
                    />

                    {/* Progress/Resolution Tracker */}
                    {stick.workflow_status && (
                      <Card className="bg-white border shadow-sm">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">Workflow Progress</h4>
                            {stick.workflow_owner && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Avatar className="h-5 w-5">
                                  {stick.workflow_owner.avatar_url && (
                                    <AvatarImage src={stick.workflow_owner.avatar_url} />
                                  )}
                                  <AvatarFallback className="text-[10px]">
                                    {(stick.workflow_owner.full_name || stick.workflow_owner.email).substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{stick.workflow_owner.full_name || stick.workflow_owner.email}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            {WORKFLOW_ORDER.map((status, index) => {
                              const config = WORKFLOW_STATUSES[status]
                              const isCurrent = stick.workflow_status === status
                              const isPast = WORKFLOW_ORDER.indexOf(stick.workflow_status!) > index
                              return (
                                <div key={status} className="flex items-center flex-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className={`flex flex-col items-center ${isCurrent ? 'scale-110' : ''}`}>
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                            getWorkflowStepColor(isCurrent, isPast, `${config.bgColor} ${config.borderColor} ${config.color}`, 'bg-green-100 border-green-400 text-green-600', 'bg-gray-100 border-gray-300 text-gray-400')
                                          }`}>
                                            {status === 'idea' && <Lightbulb className="h-4 w-4" />}
                                            {status === 'triage' && <Filter className="h-4 w-4" />}
                                            {status === 'in_progress' && <Play className="h-4 w-4" />}
                                            {status === 'resolved' && <CheckCircle2 className="h-4 w-4" />}
                                          </div>
                                          <span className={`text-xs mt-1 font-medium ${getWorkflowStepColor(isCurrent, isPast, config.color, 'text-green-600', 'text-gray-400')}`}>
                                            {config.label}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{config.description}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {index < WORKFLOW_ORDER.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {stick.workflow_due_date && (
                            <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {new Date(stick.workflow_due_date).toLocaleDateString()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Discussion Template Section */}
                    {templateProgress ? (
                      <DiscussionTemplateProgress
                        progress={templateProgress}
                        templateCategory={templateAssignment?.template?.category}
                        onRemoveTemplate={handleRemoveTemplate}
                      />
                    ) : (
                      <Card className="bg-white border border-dashed border-gray-300 shadow-sm">
                        <CardContent className="py-6 text-center">
                          <div className="text-gray-500 mb-3">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No discussion template applied</p>
                            <p className="text-xs text-gray-400">Templates help guide the conversation flow</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowTemplatePicker(true)}
                          >
                            Apply Template
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Guided Prompts */}
                    {templateProgress && templateProgress.suggestedPrompts.length > 0 && (
                      <GuidedPromptsPanel
                        prompts={templateProgress.suggestedPrompts}
                        onSelectPrompt={handleGuidedPromptSelect}
                      />
                    )}

                    <div className="space-y-4">
                      {/* Header with View Toggle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Replies ({replyCount})</h3>
                        <div className="flex items-center gap-2">
                          {/* View Mode Toggle */}
                          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => setViewMode('grouped')}
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1 sm:gap-1.5 ${
                                viewMode === 'grouped'
                                  ? 'bg-white text-gray-900 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              <LayoutList className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">Grouped</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewMode('timeline')}
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1 sm:gap-1.5 ${
                                viewMode === 'timeline'
                                  ? 'bg-white text-gray-900 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">Timeline</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Category Tabs (Horizontal) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => scrollCategoryTabs('left')}
                          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md rounded-full p-1 hover:bg-gray-100"
                          aria-label="Scroll left"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div
                          ref={categoryTabsRef}
                          className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-8 py-2"
                          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                          <button
                            type="button"
                            onClick={resetCategories}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                              selectedCategories.length === REPLY_CATEGORIES.length
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                            }`}
                          >
                            All ({replyCount})
                          </button>
                          {REPLY_CATEGORIES.filter(cat => categoriesWithReplies.has(cat.value)).map((category) => {
                            const count = categoryCounts.get(category.value) || 0
                            const isSelected = selectedCategories.length === 1 && selectedCategories[0] === category.value
                            return (
                              <button
                                type="button"
                                key={category.value}
                                onClick={() => selectOnlyCategory(category.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                                  isSelected
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                }`}
                              >
                                {category.label} ({count})
                              </button>
                            )
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => scrollCategoryTabs('right')}
                          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md rounded-full p-1 hover:bg-gray-100"
                          aria-label="Scroll right"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Grouped View */}
                      {viewMode === 'grouped' && (
                        <>
                          {filteredReplies.length > 0 ? (
                            <div className="space-y-6">
                              {Array.from(groupedReplies.entries()).map(([category, replies]) => (
                                <div key={category} className="space-y-3">
                                  <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    {category}
                                    <Badge variant="outline">{replies.length}</Badge>
                                  </h4>
                                  <ul className="space-y-2">{replies.map((reply) => renderReply(reply))}</ul>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Card>
                              <CardContent className="py-12 text-center text-gray-500">
                                {selectedCategories.length === 0
                                  ? "Please select at least one category to view replies."
                                  : "No replies yet. Be the first to reply!"}
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}

                      {/* Timeline View */}
                      {viewMode === 'timeline' && (
                        <>
                          {timelineSortedReplies.length > 0 ? (
                            <div className="relative">
                              {/* Vertical timeline line */}
                              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                              <div className="space-y-4">
                                {timelineSortedReplies.map((reply, index) => {
                                  const milestone = getMilestone(reply, index)
                                  const replyDate = new Date(reply.created_at)
                                  const prevDate = index > 0 ? new Date(timelineSortedReplies[index - 1].created_at) : null
                                  const showDateHeader = replyDate.toDateString() !== prevDate?.toDateString()

                                  return (
                                    <div key={reply.id}>
                                      {/* Date Header */}
                                      {showDateHeader && (
                                        <div className="flex items-center gap-3 mb-3 ml-8">
                                          <div className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                            {replyDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                          </div>
                                        </div>
                                      )}

                                      <div className="relative flex items-start gap-4">
                                        {/* Timeline dot */}
                                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                                          milestone
                                            ? 'bg-purple-100 border-2 border-purple-400'
                                            : 'bg-white border-2 border-gray-300'
                                        }`}>
                                          {milestone?.type === 'first' && <MessageSquare className="h-4 w-4 text-purple-600" />}
                                          {milestone?.type === 'answer' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                          {milestone?.type === 'status' && <Clock className="h-4 w-4 text-blue-600" />}
                                          {milestone?.type === 'correction' && <Filter className="h-4 w-4 text-amber-600" />}
                                          {!milestone && <div className="w-2 h-2 rounded-full bg-gray-400" />}
                                        </div>

                                        {/* Reply content */}
                                        <div className="flex-1 min-w-0">
                                          {milestone && (
                                            <div className="mb-2">
                                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                                {milestone.label}
                                              </Badge>
                                            </div>
                                          )}
                                          <div className="bg-white rounded-lg border shadow-sm p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-sm font-medium text-gray-900">
                                                {reply.users?.full_name || reply.users?.email || 'Unknown'}
                                              </span>
                                              <Badge variant="outline" className="text-xs">
                                                {reply.category || 'Default'}
                                              </Badge>
                                              <span className="text-xs text-gray-500">
                                                {replyDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                              </span>
                                            </div>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ) : (
                            <Card>
                              <CardContent className="py-12 text-center text-gray-500">
                                No replies yet. Be the first to reply!
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>

      <ReplyModal
        open={replyModalOpen}
        onOpenChange={(open) => {
          setReplyModalOpen(open)
          if (!open) {
            setParentReply(null)
            setSuggestedCategory(null)
          }
        }}
        onSubmit={handleSubmitReply}
        parentReplyContent={parentReply?.content}
        title={parentReply ? "Reply to Comment" : "Reply to Stick"}
        suggestedCategory={suggestedCategory || undefined}
        guidedPrompts={templateProgress?.suggestedPrompts}
      />

      <DiscussionTemplatePicker
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        onSelect={handleAssignTemplate}
        currentTemplateId={templateAssignment?.discussion_template_id}
      />

      {padId && (
        <>
          <KnowledgeBaseDrawer
            open={showKBDrawer}
            onOpenChange={setShowKBDrawer}
            padId={padId}
            onSelectArticle={(_article) => {
              setShowKBDrawer(false)
              setShowCitationModal(true)
            }}
          />
          <AddCitationModal
            open={showCitationModal}
            onOpenChange={setShowCitationModal}
            stickId={stickId}
            padId={padId}
            onCitationAdded={() => {
              fetchCitations()
              setShowCitationModal(false)
            }}
          />
          <LibraryDialog
            open={showFilesDialog}
            onOpenChange={setShowFilesDialog}
            stickId={stickId}
            stickType="inference"
            title={`${stick?.topic || "Stick"} — Files`}
          />
        </>
      )}
    </>
  )
}

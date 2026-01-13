"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useUser } from "@/contexts/user-context"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Calendar, Filter, MessageSquare, BookOpen, LinkIcon, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ReplyModal, REPLY_CATEGORIES } from "@/components/social/reply-modal"
import { Badge } from "@/components/ui/badge"
import { ReplyCard } from "@/components/social/reply-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SocialStickTabs } from "@/components/social/social-stick-tabs"
import { KnowledgeBaseDrawer } from "@/components/social/knowledge-base-drawer"
import { AddCitationModal } from "@/components/social/add-citation-modal"
import { StickSummaryCard } from "@/components/social/stick-summary-card"
import { RelatedKBArticles } from "@/components/social/related-kb-articles"
import { FollowButton } from "@/components/social/follow-button"
import { toast } from "sonner"

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

interface SocialStick {
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
}

interface StickDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  onUpdate?: () => void
}

export function StickDetailModal({ open, onOpenChange, stickId, onUpdate }: StickDetailModalProps) {
  const { user } = useUser()
  const [stick, setStick] = useState<SocialStick | null>(null)
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
  const [citations, setCitations] = useState<any[]>([])
  const [padId, setPadId] = useState<string>("")

  const [isSummarizing, setIsSummarizing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id)
    }
  }, [user])

  const toggleCategory = (category: string) => {
    setSelectedCategories((prevCategories) =>
      prevCategories.includes(category) ? prevCategories.filter((c) => c !== category) : [...prevCategories, category],
    )
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
      const memberResponse = await fetchWithRetry(`/api/social-pads/${padId}/members`)
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
    const padResponse = await fetchWithRetry(`/api/social-pads/${padId}`)
    if (padResponse.ok) {
      const padData = await padResponse.json()
      setIsPadOwner(padData.pad.owner_id === user?.id)
      await fetchPadMemberRole(padId)
    }
  }

  const fetchStick = async () => {
    try {
      setLoading(true)
      const response = await fetchWithRetry(`/api/social-sticks/${stickId}`)
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
    }
  }, [stick])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchCitations = async () => {
    if (!stickId) return
    try {
      const response = await fetch(`/api/social-sticks/${stickId}/citations`)
      if (response.ok) {
        const data = await response.json()
        setCitations(data.citations || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching citations:", error)
    }
  }

  const handleDeleteCitation = async (citationId: string) => {
    if (!confirm("Remove this citation?")) return
    try {
      const response = await fetch(`/api/social-sticks/${stickId}/citations?citationId=${citationId}`, {
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
      const response = await fetch(`/api/social-sticks/${stickId}/replies`, {
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
      const response = await fetch(`/api/social-sticks/${stickId}/replies?replyId=${replyId}`, {
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
      const response = await fetch(`/api/social-sticks/${stickId}/replies`, {
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
          if (!prev || !prev.replies) return prev
          const updateReplyInList = (replies: Reply[]): Reply[] => {
            return replies.map((reply) => {
              if (reply.id === replyId) {
                return { ...reply, content, updated_at: new Date().toISOString() }
              }
              if (reply.replies && reply.replies.length > 0) {
                return { ...reply, replies: updateReplyInList(reply.replies) }
              }
              return reply
            })
          }
          return { ...prev, replies: updateReplyInList(prev.replies) }
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
      const response = await fetch(`/api/social-sticks/${stickId}/replies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_id: replyId, content: newContent }),
      })

      if (response.ok) {
        // Update reply locally
        setStick((prev) => {
          if (!prev || !prev.replies) return prev
          const updateReplyInList = (replies: Reply[]): Reply[] => {
            return replies.map((reply) => {
              if (reply.id === replyId) {
                return { ...reply, content: newContent, updated_at: new Date().toISOString() }
              }
              if (reply.replies && reply.replies.length > 0) {
                return { ...reply, replies: updateReplyInList(reply.replies) }
              }
              return reply
            })
          }
          return { ...prev, replies: updateReplyInList(prev.replies) }
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

  const filterRepliesByCategory = (replies: Reply[]): Reply[] => {
    return replies
      .filter((reply) => selectedCategories.includes(reply.category))
      .map((reply) => {
        // Create a copy of the reply with filtered nested replies
        const filteredReply = { ...reply }
        if (reply.replies && reply.replies.length > 0) {
          filteredReply.replies = filterRepliesByCategory(reply.replies)
        }
        return filteredReply
      })
  }

  const groupRepliesByCategory = (replies: Reply[]) => {
    const grouped = new Map<string, Reply[]>()

    replies.forEach((reply) => {
      if (!grouped.has(reply.category)) {
        grouped.set(reply.category, [])
      }
      grouped.get(reply.category)!.push(reply)
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
      const response = await fetch(`/api/social-sticks/${stickId}`, {
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
      const response = await fetch(`/api/social-sticks/${stickId}/summarize`, {
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
      const response = await fetch(`/api/social-sticks/${stickId}/replies`, {
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
    [organizedReplies, selectedCategories]
  )
  const groupedReplies = useMemo(
    () => groupRepliesByCategory(filteredReplies),
    [filteredReplies]
  )
  const isOwner = stick?.user_id === user?.id

  if (!stick && !loading) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[95vw] w-full p-0"
          style={{
            height: '95vh',
            maxHeight: '95vh',
            display: 'flex',
            flexDirection: 'column',
            top: '2.5vh',
            transform: 'translateX(-50%)',
          }}
        >
          <DialogTitle className="sr-only">Stick Details</DialogTitle>
          <DialogDescription className="sr-only">View and manage stick content, replies, and media</DialogDescription>

          <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', flexShrink: 0 }}>
            <h2 className="text-2xl font-bold text-gray-900">Stick Details</h2>
          </div>

          <div className="custom-scrollbar" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              )}
              {!loading && stick && (
                <div className="p-6 pb-16 bg-gray-50">
                  <div className="max-w-4xl mx-auto space-y-6">
                    <Card className="bg-white border-2 shadow-lg">
                      <CardHeader>
                        <div className="flex items-center justify-between mb-4">
                          <CardTitle className="text-2xl">Stick Content</CardTitle>
                          <div className="flex gap-2">
                            <FollowButton
                              entityType="social_stick"
                              entityId={stick.id}
                              entityName={stick.topic}
                              variant="icon"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setShowKBDrawer(true)}
                              title="View knowledge base"
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setShowCitationModal(true)}
                              title="Add citation"
                            >
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenReplyModal()}
                              title="Reply to stick"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <SocialStickTabs
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
                              const response = await fetch(`/api/social-stick-tabs`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ socialStickId: stickId, details }),
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

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">Replies ({replyCount})</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Filter className="h-4 w-4 mr-2" />
                              Filter by Category
                              {selectedCategories.length < REPLY_CATEGORIES.length && (
                                <Badge variant="secondary" className="ml-2">
                                  {selectedCategories.length}
                                </Badge>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {REPLY_CATEGORIES.map((category) => (
                              <DropdownMenuCheckboxItem
                                key={category.value}
                                checked={selectedCategories.includes(category.value)}
                                onCheckedChange={() => toggleCategory(category.value)}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{category.label}</span>
                                  <span className="text-xs text-gray-500">{category.description}</span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

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
          }
        }}
        onSubmit={handleSubmitReply}
        parentReplyContent={parentReply?.content}
        title={parentReply ? "Reply to Comment" : "Reply to Stick"}
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
        </>
      )}
    </>
  )
}

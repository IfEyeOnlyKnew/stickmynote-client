"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { UserMenu } from "@/components/user-menu"
import { Trash2, Edit2, MessageSquare, Save, X, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { ReplyModal } from "@/components/social/reply-modal"

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
  created_at: string
  updated_at: string
  user_id: string
  parent_reply_id: string | null
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
  social_pads: {
    id: string
    name: string
    owner_id: string
  }
  replies?: Reply[]
}

interface ReplyCardProps {
  reply: Reply
  depth?: number
  editingReplyId: string | null
  editContent: string
  userId?: string
  parentAuthor?: string
  onEditContentChange: (content: string) => void
  onStartEdit: (reply: Reply) => void
  onCancelEdit: () => void
  onSaveEdit: (replyId: string) => void
  onOpenReplyModal: (reply?: Reply) => void
  getDisplayName: (reply: Reply) => string
  getInitials: (reply: Reply) => string
}

function ReplyCard({
  reply,
  depth = 0,
  editingReplyId,
  editContent,
  userId,
  parentAuthor,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenReplyModal,
  getDisplayName,
  getInitials,
}: Readonly<ReplyCardProps>) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isEditing = editingReplyId === reply.id
  const isOwner = reply.user_id === userId
  const hasReplies = reply.replies && reply.replies.length > 0
  const replyCount = reply.replies?.length || 0

  // Get depth-based styling
  const depthColors = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const indentPx = depth * 24 // 24px per level

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

        <Card className={`border-2 shadow-lg hover:shadow-xl transition-shadow ${depth > 0 ? depthColors.bg : "bg-white"}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10">
                {reply.users?.avatar_url && (
                  <AvatarImage src={reply.users.avatar_url || "/placeholder.svg"} alt={getDisplayName(reply)} />
                )}
                <AvatarFallback>{getInitials(reply)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{getDisplayName(reply)}</span>
                    <span className="text-sm text-gray-500">{new Date(reply.created_at).toLocaleString()}</span>
                    {reply.updated_at !== reply.created_at && <span className="text-xs text-gray-400">(edited)</span>}
                  </div>
                  <div className="flex gap-2">
                    {isOwner && !isEditing && (
                      <Button variant="ghost" size="sm" onClick={() => onStartEdit(reply)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onOpenReplyModal(reply)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
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
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => onEditContentChange(e.target.value)}
                      rows={3}
                      maxLength={1000}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{editContent.length}/1000</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onCancelEdit}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => onSaveEdit(reply.id)}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">{reply.content}</p>
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
          <div className="space-y-4 mt-4">
            {reply.replies!.map((nestedReply) => (
              <ReplyCard
                key={nestedReply.id}
                reply={nestedReply}
                depth={depth + 1}
                editingReplyId={editingReplyId}
                editContent={editContent}
                userId={userId}
                parentAuthor={getDisplayName(reply)}
                onEditContentChange={onEditContentChange}
                onStartEdit={onStartEdit}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onOpenReplyModal={onOpenReplyModal}
                getDisplayName={getDisplayName}
                getInitials={getInitials}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SocialStickDetailPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const params = useParams()
  const stickId = params.stickId as string

  const [stick, setStick] = useState<SocialStick | null>(null)
  const [loadingStick, setLoadingStick] = useState(true)
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [parentReply, setParentReply] = useState<Reply | null>(null)
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
    }
  }, [user, loading, router])

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (user && stickId) {
      fetchStick()
    }
  }, [user, stickId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchStick = async () => {
    try {
      console.log("[v0] Fetching stick data for:", stickId)
      setLoadingStick(true)
      const response = await fetch(`/api/social-sticks/${stickId}`)
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Fetched stick data:", data.stick)
        console.log("[v0] Number of replies:", data.stick.replies?.length || 0)
        setStick({ ...data.stick, replies: [...(data.stick.replies || [])] })
      } else if (response.status === 403) {
        alert("You don't have access to this stick")
        router.push("/social")
      }
    } catch (error) {
      console.error("[v0] Error fetching stick:", error)
    } finally {
      setLoadingStick(false)
    }
  }

  const handleSubmitReply = async (content: string) => {
    if (!stick) return

    try {
      console.log("[v0] Submitting reply:", {
        content,
        parent_reply_id: parentReply?.id || null,
        stickId,
      })

      const response = await fetch(`/api/social-sticks/${stickId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          color: "#fef3c7",
          parent_reply_id: parentReply?.id || null,
        }),
      })

      console.log("[v0] Reply submission response status:", response.status)

      if (response.ok) {
        const result = await response.json()
        console.log("[v0] Reply created successfully:", result.reply)

        const newReply: Reply = {
          ...result.reply,
          replies: [],
        }

        setStick((prevStick) => {
          if (!prevStick) return prevStick
          return {
            ...prevStick,
            replies: [...(prevStick.replies || []), newReply],
          }
        })

        console.log("[v0] Reply added to state")
        setParentReply(null)
      } else {
        const errorData = await response.json()
        console.error("[v0] Failed to submit reply:", errorData)
        alert("Failed to submit reply. Please try again.")
      }
    } catch (error) {
      console.error("[v0] Error submitting reply:", error)
      alert("An error occurred while submitting your reply.")
    }
  }

  const handleStartEdit = (reply: Reply) => {
    setEditingReplyId(reply.id)
    setEditContent(reply.content)
  }

  const handleCancelEdit = () => {
    setEditingReplyId(null)
    setEditContent("")
  }

  const handleSaveEdit = async (replyId: string) => {
    if (!editContent.trim()) return

    try {
      const response = await fetch(`/api/social-sticks/${stickId}/replies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply_id: replyId,
          content: editContent,
        }),
      })

      if (response.ok) {
        setEditingReplyId(null)
        setEditContent("")
        setStick((prevStick) => {
          if (!prevStick?.replies) return prevStick
          return {
            ...prevStick,
            replies: prevStick.replies.map((reply) =>
              reply.id === replyId ? { ...reply, content: editContent, updated_at: new Date().toISOString() } : reply,
            ),
          }
        })
      }
    } catch (error) {
      console.error("Error updating reply:", error)
    }
  }

  const handleOpenReplyModal = (reply?: Reply) => {
    setParentReply(reply || null)
    setReplyModalOpen(true)
  }

  const getDisplayName = (reply: Reply) => {
    if (!reply.users) return "Unknown User"
    return reply.users.full_name || reply.users.username || reply.users.email
  }

  const getInitials = (reply: Reply) => {
    if (!reply.users) return "??"
    const name = reply.users.full_name || reply.users.username || reply.users.email
    return name.substring(0, 2).toUpperCase()
  }

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

    return rootReplies
  }

  if (loading || loadingStick) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user || !stick) return null

  const organizedReplies = stick.replies ? organizeReplies(stick.replies) : []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Social Hub", href: "/social" },
              { label: stick.social_pads.name, href: `/social/pads/${stick.social_pad_id}` },
              { label: stick.topic, current: true },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{stick.topic}</h1>
              <p className="text-sm text-gray-500">in {stick.social_pads.name}</p>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-8 bg-white border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-2xl">{stick.topic}</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleOpenReplyModal()}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
                {stick.user_id === user.id && (
                  <>
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-800 whitespace-pre-wrap">{stick.content}</p>
            <div className="mt-4 text-sm text-gray-500">Created {new Date(stick.created_at).toLocaleString()}</div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Replies ({stick.replies?.length || 0})</h2>
          {organizedReplies.length > 0 ? (
            <div className="space-y-4">
              {organizedReplies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  editingReplyId={editingReplyId}
                  editContent={editContent}
                  userId={user?.id}
                  onEditContentChange={setEditContent}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onOpenReplyModal={handleOpenReplyModal}
                  getDisplayName={getDisplayName}
                  getInitials={getInitials}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No replies yet. Be the first to reply!
              </CardContent>
            </Card>
          )}
        </div>
      </main>

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
    </div>
  )
}

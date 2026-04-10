"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ChevronDown,
  ChevronRight,
  Eye,
  MessagesSquare,
  Video,
  User,
  Calendar,
  MessageSquare,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Clock,
  LayoutList,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { WorkflowStatusBadge } from "./workflow-status-badge"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import type { WorkflowStatus } from "@/types/inference-workflow"

interface Reply {
  id: string
  content: string
  color: string
  category?: string
  created_at: string
  calstick_id?: string | null
  promoted_at?: string | null
  users?: {
    full_name: string | null
    email: string
  }
}

interface InferenceStick {
  id: string
  topic: string
  content: string
  color: string
  social_pad_id?: string
  user_id?: string
  created_at: string
  users?: {
    id?: string
    full_name: string | null
    email: string
  } | null
  reply_count?: number
  live_summary?: string
  workflow_status?: WorkflowStatus
  workflow_owner_id?: string | null
  calstick_id?: string | null
}

interface MobileStickCardProps {
  stick: InferenceStick
  replies?: Reply[]
  isExpanded: boolean
  isSelected?: boolean
  onToggle?: (stickId: string) => void
  onSelect?: (stickId: string) => void
  onOpen?: (stickId: string) => void
  onView?: (stickId: string) => void  // Alternative to onOpen for backward compatibility
  onPromoteReply?: (stickId: string, topic: string, stickContent: string, replyId: string, replyContent: string) => void
  onNavigateToCalstick?: (calstickId: string) => void
}

export function MobileStickCard({
  stick,
  replies = [],
  isExpanded,
  isSelected = false,
  onToggle,
  onSelect,
  onOpen,
  onView,
  onPromoteReply,
  onNavigateToCalstick,
}: Readonly<MobileStickCardProps>) {
  const router = useRouter()
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grouped' | 'timeline'>('grouped')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Calculate category counts
  const categoryCounts = new Map<string, number>()
  if (replies) {
    for (const reply of replies) {
      const cat = reply.category || "Default"
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    }
  }

  // Filter replies by selected category
  const filteredReplies = selectedCategory
    ? replies.filter(r => (r.category || "Default") === selectedCategory)
    : replies

  // Group replies by category
  const groupedReplies = new Map<string, Reply[]>()
  for (const reply of filteredReplies) {
    const cat = reply.category || "Default"
    if (!groupedReplies.has(cat)) groupedReplies.set(cat, [])
    groupedReplies.get(cat)!.push(reply)
  }

  // Sort replies chronologically for timeline
  const timelineSortedReplies = [...filteredReplies].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Detect milestones for timeline
  const getMilestone = useCallback((reply: Reply, index: number): { type: string; label: string } | null => {
    if (index === 0) return { type: 'first', label: 'First Reply' }
    if (reply.category === 'Answer') return { type: 'answer', label: 'Answer Posted' }
    if (reply.category === 'Status Update') return { type: 'status', label: 'Status Update' }
    return null
  }, [])

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a')
    ) {
      return
    }
    onToggle?.(stick.id)
  }, [onToggle, stick.id])

  const handleCheckboxChange = useCallback(() => {
    onSelect?.(stick.id)
  }, [onSelect, stick.id])

  const handleOpenClick = useCallback(() => {
    // Support both onOpen and onView for backward compatibility
    const openFn = onOpen || onView
    openFn?.(stick.id)
  }, [onOpen, onView, stick.id])

  const handleChatClick = useCallback(() => {
    setChatModalOpen(true)
  }, [])

  const handleVideoClick = useCallback(() => {
    router.push("/video")
  }, [router])

  return (
    <>
      <Card className="w-full max-w-full min-w-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Header: Checkbox, Color bar, Topic, Expand */}
          <button type="button" className="flex items-start gap-2 bg-transparent border-none p-0 text-left w-full cursor-pointer" onClick={handleCardClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCardClick?.(e as unknown as React.MouseEvent) }}>
            {onSelect && (
              <span role="none" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={handleCheckboxChange}
                />
              </span>
            )}
            <div className="w-1 h-8 rounded flex-shrink-0" style={{ backgroundColor: stick.color }} />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{stick.topic}</h3>
            </div>
            {onToggle && (
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
          </button>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <WorkflowStatusBadge status={stick.workflow_status || "idea"} size="sm" />
            <Badge variant="secondary" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {stick.reply_count || 0}
            </Badge>
          </div>

          {/* Content */}
          <div className="text-sm text-gray-600">
            {stick.live_summary ? (
              <div className="space-y-1">
                <p className="line-clamp-2">{stick.content}</p>
                <p className="text-xs text-blue-600 italic line-clamp-1">{stick.live_summary}</p>
              </div>
            ) : (
              <p className="line-clamp-3">{stick.content}</p>
            )}
          </div>

          {/* Author and Time */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{stick.users?.full_name || stick.users?.email || "Unknown"}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Calendar className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenClick}
              className="flex-1 text-xs"
              title="View and edit stick"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleChatClick}
              className="flex-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              title="New chat"
            >
              <MessagesSquare className="h-4 w-4 mr-1" />
              Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVideoClick}
              className="flex-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Start video call"
            >
              <Video className="h-4 w-4 mr-1" />
              Video
            </Button>
          </div>

          {/* Expanded Replies Section */}
          {isExpanded && replies && replies.length > 0 && (
            <div className="pt-3 border-t space-y-3">
              {/* Header with view toggle */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Replies ({replies.length})
                </h4>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                      viewMode === 'grouped'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Grouped view"
                    aria-label="Grouped view"
                  >
                    <LayoutList className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('timeline')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                      viewMode === 'timeline'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Timeline view"
                    aria-label="Timeline view"
                  >
                    <Clock className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              {categoryCounts.size > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-all border ${
                      selectedCategory === null
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    All ({replies.length})
                  </button>
                  {Array.from(categoryCounts.entries()).map(([category, count]) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-all border ${
                        selectedCategory === category
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {category} ({count})
                    </button>
                  ))}
                </div>
              )}

              {/* Grouped View */}
              {viewMode === 'grouped' && (
                <div className="space-y-3">
                  {Array.from(groupedReplies.entries()).map(([category, categoryReplies]) => (
                    <div key={category}>
                      <h5 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                        {category}
                        <Badge variant="outline" className="text-xs">{categoryReplies.length}</Badge>
                      </h5>
                      <div className="space-y-2">
                        {categoryReplies.map((reply) => (
                          <ReplyCard
                            key={reply.id}
                            reply={reply}
                            timeLabel={formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            onNavigateToCalstick={onNavigateToCalstick}
                            onPromote={() => onPromoteReply?.(stick.id, stick.topic, stick.content || '', reply.id, reply.content)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline View */}
              {viewMode === 'timeline' && (
                <div className="relative">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-2">
                    {timelineSortedReplies.map((reply, index) => {
                      const milestone = getMilestone(reply, index)
                      const replyDate = new Date(reply.created_at)
                      const prevDate = index > 0 ? new Date(timelineSortedReplies[index - 1].created_at) : null
                      const showDateHeader = replyDate.toDateString() !== prevDate?.toDateString()

                      return (
                        <div key={reply.id}>
                          {showDateHeader && (
                            <div className="flex items-center gap-2 mb-1 ml-5">
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {replyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                          <div className="relative flex items-start gap-2">
                            <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center ${
                              milestone ? 'bg-purple-100 border-2 border-purple-400' : 'bg-white border-2 border-gray-300'
                            }`}>
                              {milestone?.type === 'first' && <MessageSquare className="h-2.5 w-2.5 text-purple-600" />}
                              {milestone?.type === 'answer' && <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />}
                              {milestone?.type === 'status' && <Clock className="h-2.5 w-2.5 text-blue-600" />}
                              {!milestone && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              {milestone && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 mb-1">
                                  {milestone.label}
                                </Badge>
                              )}
                              <ReplyCard
                                reply={reply}
                                timeLabel={replyDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                onNavigateToCalstick={onNavigateToCalstick}
                                onPromote={() => onPromoteReply?.(stick.id, stick.topic, stick.content || '', reply.id, reply.content)}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No replies message */}
          {isExpanded && (!replies || replies.length === 0) && (
            <div className="pt-3 border-t">
              <p className="text-xs text-gray-500 italic text-center py-2">No replies yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={stick.topic}
        autoSubmit
      />
    </>
  )
}

function ReplyCard({
  reply,
  timeLabel,
  onNavigateToCalstick,
  onPromote,
}: Readonly<{
  reply: Reply
  timeLabel: string
  onNavigateToCalstick?: (calstickId: string) => void
  onPromote: () => void
}>) {
  return (
    <div
      className="p-2 rounded border-l-2 bg-gray-50"
      style={{ borderLeftColor: reply.color }}
    >
      <p className="text-xs mb-1">{reply.content}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-1 min-w-0">
          <span className="truncate">{reply.users?.full_name || reply.users?.email || "Unknown"}</span>
          <span>•</span>
          <span className="flex-shrink-0">{timeLabel}</span>
        </div>
        {reply.calstick_id ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateToCalstick?.(reply.calstick_id!)}
            className="text-green-600 hover:text-green-700 hover:bg-green-50 h-6 px-2 flex-shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPromote}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 h-6 px-2 flex-shrink-0"
          >
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

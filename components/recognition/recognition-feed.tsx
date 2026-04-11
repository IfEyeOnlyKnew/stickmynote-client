"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, Send, ChevronDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { RecognitionFeedItem, KudosComment } from "@/types/recognition"
import { KUDOS_REACTION_TYPES } from "@/types/recognition"

interface RecognitionFeedProps {
  filterValueId?: string | null
}

export function RecognitionFeed({ filterValueId }: Readonly<RecognitionFeedProps>) {
  const [feedItems, setFeedItems] = useState<RecognitionFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({})
  const [commentsData, setCommentsData] = useState<Record<string, KudosComment[]>>({})

  const fetchFeed = useCallback(async (newOffset: number, append = false) => {
    try {
      const params = new URLSearchParams({ limit: "20", offset: String(newOffset) })
      if (filterValueId) params.set("valueId", filterValueId)

      const res = await fetch(`/api/recognition/feed?${params}`)
      const data = await res.json()
      const items = data.feed || []

      if (append) {
        setFeedItems(prev => [...prev, ...items])
      } else {
        setFeedItems(items)
      }
      setHasMore(items.length === 20)
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [filterValueId])

  useEffect(() => {
    setOffset(0)
    setLoading(true)
    fetchFeed(0, false)
  }, [fetchFeed])

  const loadMore = () => {
    const newOffset = offset + 20
    setOffset(newOffset)
    fetchFeed(newOffset, true)
  }

  const toggleReaction = async (kudosId: string, reactionType: string) => {
    try {
      const res = await fetch(`/api/recognition/kudos/${kudosId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType }),
      })
      const data = await res.json()

      // Update local state
      setFeedItems(prev => prev.map(item => {
        if (item.kudos_id !== kudosId) return item
        const delta = data.action === "added" ? 1 : -1
        return {
          ...item,
          reaction_count: Math.max(0, (item.reaction_count || 0) + delta),
          user_has_reacted: data.action === "added",
        }
      }))
    } catch {
      // silently fail
    }
  }

  const toggleComments = async (kudosId: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(kudosId)) {
      newExpanded.delete(kudosId)
    } else {
      newExpanded.add(kudosId)
      // Fetch comments if not loaded
      if (!commentsData[kudosId]) {
        try {
          const res = await fetch(`/api/recognition/kudos/${kudosId}/comments`)
          const data = await res.json()
          setCommentsData(prev => ({ ...prev, [kudosId]: data.comments || [] }))
        } catch {
          setCommentsData(prev => ({ ...prev, [kudosId]: [] }))
        }
      }
    }
    setExpandedComments(newExpanded)
  }

  const submitComment = async (kudosId: string) => {
    const content = commentTexts[kudosId]?.trim()
    if (!content) return

    try {
      const res = await fetch(`/api/recognition/kudos/${kudosId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()

      if (data.comment) {
        setCommentsData(prev => ({
          ...prev,
          [kudosId]: [...(prev[kudosId] || []), data.comment],
        }))
        setFeedItems(prev => prev.map(item =>
          item.kudos_id === kudosId
            ? { ...item, comment_count: (item.comment_count || 0) + 1 }
            : item
        ))
        setCommentTexts(prev => ({ ...prev, [kudosId]: "" }))
      }
    } catch {
      // silently fail
    }
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (feedItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-4xl mb-3">🌟</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No kudos yet</h3>
          <p className="text-gray-500">Be the first to recognize someone&apos;s great work!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {feedItems.map(item => (
        <Card key={item.kudos_id} className="hover:shadow-md transition-shadow overflow-hidden">
          <CardContent className="p-0">
            {/* Value color bar */}
            {item.value_color && (
              <div className="h-1" style={{ backgroundColor: item.value_color }} />
            )}

            <div className="p-5">
              {/* Header: Giver info */}
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={item.giver_avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white text-sm">
                    {getInitials(item.giver_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{item.giver_name}</span>
                    <span className="text-gray-400">recognized</span>
                    {item.recipients?.map((r, i) => (
                      <span key={r.user_id}>
                        <span className="font-semibold text-gray-900">{r.full_name}</span>
                        {i < item.recipients.length - 1 && <span className="text-gray-400">, </span>}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                    {item.value_name && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: (item.value_color || "#f59e0b") + "20", color: item.value_color || "#f59e0b" }}
                      >
                        {item.value_emoji} {item.value_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="ml-13 pl-[52px]">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{item.message}</p>
              </div>

              {/* Actions bar */}
              <div className="flex items-center gap-4 mt-4 pl-[52px]">
                {/* Quick reaction */}
                <button
                  type="button"
                  onClick={() => toggleReaction(item.kudos_id, "celebrate")}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-all ${
                    item.user_has_reacted
                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <span>🎉</span>
                  {item.reaction_count > 0 && <span>{item.reaction_count}</span>}
                </button>

                {/* More reactions */}
                <div className="flex items-center gap-0.5">
                  {KUDOS_REACTION_TYPES.slice(1).map(rt => (
                    <button
                      type="button"
                      key={rt.type}
                      onClick={() => toggleReaction(item.kudos_id, rt.type)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-sm transition-transform hover:scale-125"
                      title={rt.label}
                    >
                      {rt.emoji}
                    </button>
                  ))}
                </div>

                {/* Comments toggle */}
                <button
                  type="button"
                  onClick={() => toggleComments(item.kudos_id)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 ml-auto"
                >
                  <MessageCircle className="h-4 w-4" />
                  {item.comment_count > 0 ? `${item.comment_count} comments` : "Comment"}
                </button>
              </div>

              {/* Comments Section */}
              {expandedComments.has(item.kudos_id) && (
                <div className="mt-4 pl-[52px] border-t pt-4 space-y-3">
                  {(commentsData[item.kudos_id] || []).map(comment => (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={comment.user_avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-gray-200">
                          {getInitials(comment.user_full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comment.user_full_name}</span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Add comment */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={commentTexts[item.kudos_id] || ""}
                      onChange={(e) => setCommentTexts(prev => ({ ...prev, [item.kudos_id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment(item.kudos_id)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => submitComment(item.kudos_id)}
                      disabled={!commentTexts[item.kudos_id]?.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={loadMore} className="w-full">
            <ChevronDown className="h-4 w-4 mr-2" />
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Calendar, Heart, MessageCircle, Eye, ExternalLink, Copy, Bookmark, Hash } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Note } from "@/types/note"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface OptimisticState {
  likes: number
  isLiked: boolean
  isBookmarked: boolean
}

interface OptimisticSearchResultCardProps {
  note: Note
  searchTerm?: string
  onOpen: (noteId: string) => void
  currentUserId?: string
}

export function OptimisticSearchResultCard({
  note,
  searchTerm,
  onOpen,
  currentUserId,
}: Readonly<OptimisticSearchResultCardProps>) {
  const { toast } = useToast()

  const [isHovered, setIsHovered] = useState(false)
  const [viewCount, setViewCount] = useState<number>(0)
  const [, setIsLoadingCounts] = useState(true)
  const fetchedRef = useRef(false)
  const pendingActionRef = useRef(false)

  const [optimisticState, setOptimisticState] = useState<OptimisticState>({
    likes: 0,
    isLiked: false,
    isBookmarked: false,
  })

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const fetchCounts = async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000))

      try {
        const viewRes = await fetch(`/api/notes/${note.id}/view-count`)

        if (viewRes.ok) {
          const contentType = viewRes.headers.get("content-type")
          if (contentType?.includes("application/json")) {
            const viewData = await viewRes.json()
            setViewCount(viewData.count || 0)
          }
        }

        const likeRes = await fetch(`/api/notes/${note.id}/like`)
        if (likeRes.ok) {
          const contentType = likeRes.headers.get("content-type")
          if (contentType?.includes("application/json")) {
            const likeData = await likeRes.json()
            setOptimisticState((prev) => ({
              ...prev,
              likes: likeData.likeCount || 0,
              isLiked: likeData.isLiked || false,
            }))
          }
        }

        const bookmarkRes = await fetch(`/api/notes/${note.id}/bookmark`)
        if (bookmarkRes.ok) {
          const contentType = bookmarkRes.headers.get("content-type")
          if (contentType?.includes("application/json")) {
            const bookmarkData = await bookmarkRes.json()
            setOptimisticState((prev) => ({
              ...prev,
              isBookmarked: bookmarkData.isBookmarked || false,
            }))
          }
        }
      } catch {
        // Non-critical — counts and bookmark state fall back to defaults
      } finally {
        setIsLoadingCounts(false)
      }
    }
    fetchCounts()
  }, [note.id])

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (pendingActionRef.current) return
    pendingActionRef.current = true

    const newIsLiked = !optimisticState.isLiked
    const newLikes = optimisticState.likes + (newIsLiked ? 1 : -1)

    setOptimisticState((prev) => ({ ...prev, isLiked: newIsLiked, likes: newLikes }))

    try {
      const response = await fetch(`/api/notes/${note.id}/like`, {
        method: "POST",
      })

      if (response.status === 429) {
        toast({
          title: "Please slow down",
          description: "Too many requests. Try again in a moment.",
          variant: "destructive",
        })
        setOptimisticState((prev) => ({
          ...prev,
          isLiked: !newIsLiked,
          likes: prev.likes + (newIsLiked ? -1 : 1),
        }))
      } else if (!response.ok) {
        setOptimisticState((prev) => ({
          ...prev,
          isLiked: !newIsLiked,
          likes: prev.likes + (newIsLiked ? -1 : 1),
        }))
        toast({
          title: "Error",
          description: "Failed to update like",
          variant: "destructive",
        })
      }
    } catch (error) {
      setOptimisticState((prev) => ({
        ...prev,
        isLiked: !newIsLiked,
        likes: prev.likes + (newIsLiked ? -1 : 1),
      }))
    } finally {
      setTimeout(() => {
        pendingActionRef.current = false
      }, 500)
    }
  }

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (pendingActionRef.current) return
    pendingActionRef.current = true

    const newIsBookmarked = !optimisticState.isBookmarked

    setOptimisticState((prev) => ({ ...prev, isBookmarked: newIsBookmarked }))

    try {
      const response = await fetch(`/api/notes/${note.id}/bookmark`, {
        method: "POST",
      })

      if (response.status === 429) {
        toast({
          title: "Please slow down",
          description: "Too many requests. Try again in a moment.",
          variant: "destructive",
        })
        setOptimisticState((prev) => ({ ...prev, isBookmarked: !newIsBookmarked }))
      } else if (response.ok) {
        toast({
          title: newIsBookmarked ? "Bookmarked" : "Removed bookmark",
          description: newIsBookmarked ? "Note saved to your bookmarks" : "Note removed from bookmarks",
        })
      } else {
        setOptimisticState((prev) => ({ ...prev, isBookmarked: !newIsBookmarked }))
        toast({
          title: "Error",
          description: "Failed to update bookmark",
          variant: "destructive",
        })
      }
    } catch (error) {
      setOptimisticState((prev) => ({ ...prev, isBookmarked: !newIsBookmarked }))
    } finally {
      setTimeout(() => {
        pendingActionRef.current = false
      }, 500)
    }
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const noteUrl = `${globalThis.location.origin}/personal/${note.id}`
    navigator.clipboard.writeText(noteUrl)
    toast({
      title: "Link copied",
      description: "Note link copied to clipboard",
    })
  }

  const handleOpen = () => {
    fetch(`/api/notes/${note.id}/view`, { method: "POST" }).catch((error) => {
      console.error("Error tracking view:", error)
    })
    setViewCount((prev) => prev + 1)
    onOpen(note.id)
  }

  const highlightText = (text: string, term?: string) => {
    if (!term || !text) return text

    const parts = text.split(new RegExp(`(${term})`, "gi"))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={`highlight-${i}`} className="bg-yellow-200 text-gray-900 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={`text-${i}`}>{part}</span>
          ),
        )}
      </>
    )
  }

  const getExcerpt = (content: string) => {
    const text = content.replaceAll(/<[^>]*>/g, "").trim()
    return text.length > 100 ? text.substring(0, 100) + "..." : text
  }

  const socialSignals = {
    likes: optimisticState.likes,
    replies: note.replies?.length || 0,
    views: viewCount,
  }

  const author = (note as any).user || null
  const authorName = author?.username || author?.full_name || "Anonymous"
  const authorInitials = authorName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const formattedDate = note.created_at ? formatDistanceToNow(new Date(note.created_at), { addSuffix: true }) : ""

  return (
    <Card
      className="relative group hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden bg-white border-2 border-gray-300 hover:border-gray-400"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleOpen}
    >
      <div className="relative p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 border-2 border-white shadow-md">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">{authorInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{authorName}</p>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="h-3 w-3" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {isHovered && (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right duration-200">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-white/80 hover:bg-white shadow-sm"
                onClick={handleCopy}
                title="Copy link to clipboard"
              >
                <Copy className="h-4 w-4 text-gray-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 shadow-sm transition-all ${
                  optimisticState.isBookmarked ? "bg-indigo-100 hover:bg-indigo-200" : "bg-white/80 hover:bg-white"
                }`}
                onClick={handleBookmark}
                title={optimisticState.isBookmarked ? "Remove bookmark" : "Bookmark this note"}
              >
                <Bookmark
                  className={`h-4 w-4 transition-colors ${
                    optimisticState.isBookmarked ? "text-indigo-600 fill-indigo-600" : "text-gray-600"
                  }`}
                />
              </Button>
            </div>
          )}
        </div>

        {note.topic && (
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{highlightText(note.topic, searchTerm)}</h3>
        )}

        <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
          {highlightText(getExcerpt(note.content), searchTerm)}
        </p>

        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {note.tags.slice(0, 3).map((tag, index) => (
              <Badge
                key={`${tag}-${index}`}
                variant="secondary"
                className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700"
              >
                <Hash className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {note.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-gray-100 border border-gray-300 text-gray-500">
                +{note.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <button
              type="button"
              onClick={handleLike}
              className={`flex items-center gap-1.5 hover:text-red-500 transition-colors ${
                optimisticState.isLiked ? "text-red-500" : "text-gray-600"
              }`}
              title={optimisticState.isLiked ? "Unlike this note" : "Like this note"}
            >
              <Heart className={`h-4 w-4 ${optimisticState.isLiked ? "fill-red-500" : ""}`} />
              <span className="font-medium">{optimisticState.likes}</span>
            </button>
            <div className="flex items-center gap-1.5 hover:text-blue-500 transition-colors" title="View replies">
              <MessageCircle className="h-4 w-4" />
              <span className="font-medium">{socialSignals.replies}</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-green-500 transition-colors" title="View count">
              <Eye className="h-4 w-4" />
              <span className="font-medium">{socialSignals.views}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-indigo-600 hover:text-indigo-700 hover:bg-white/80 font-semibold"
            onClick={(e) => {
              e.stopPropagation()
              handleOpen()
            }}
            title="Open note details"
          >
            Open
            <ExternalLink className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {isHovered && (
        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full shadow-lg animate-in fade-in slide-in-from-top duration-200">
          Click to view
        </div>
      )}
    </Card>
  )
}

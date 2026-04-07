"use client"

import { useState } from "react"
import { Calendar, Heart, MessageCircle, Eye, ExternalLink, Copy, Bookmark, Hash } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Note } from "@/types/note"
import { formatDistanceToNow } from "date-fns"

interface SearchResultCardProps {
  note: Note
  searchTerm?: string
  onOpen: (noteId: string) => void
  currentUserId?: string
}

export function SearchResultCard({ note, searchTerm, onOpen, currentUserId }: Readonly<SearchResultCardProps>) {
  const [isHovered, setIsHovered] = useState(false)

  // Highlight matched terms in text
  const highlightText = (text: string, term?: string) => {
    if (!term || !text) return text

    const parts = text.split(new RegExp(`(${term})`, "gi"))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={`highlight-${i}-${part}`} className="bg-yellow-200 text-gray-900 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={`text-${i}-${part}`}>{part}</span>
          ),
        )}
      </>
    )
  }

  // Get excerpt from content (first 100 chars)
  const getExcerpt = (content: string) => {
    const text = content.replaceAll(/<[^>]*>/g, "").trim()
    return text.length > 100 ? text.substring(0, 100) + "..." : text
  }

  // Mock data for social signals (replace with real data from your API)
  const socialSignals = {
    likes: Math.floor(Math.random() * 50),
    replies: note.replies?.length || 0,
    views: Math.floor(Math.random() * 200),
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
      onClick={() => onOpen(note.id)}
    >
      <div className="relative p-5 space-y-4">
        {/* Header: Author info */}
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

          {/* Quick actions on hover */}
          {isHovered && (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right duration-200">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-white/80 hover:bg-white shadow-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  const noteUrl = `${globalThis.location.origin}/personal/${note.id}`
                  navigator.clipboard.writeText(noteUrl)
                }}
                title="Copy link to clipboard"
              >
                <Copy className="h-4 w-4 text-gray-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-white/80 hover:bg-white shadow-sm"
                onClick={(e) => {
                  e.stopPropagation()
                }}
                title="Bookmark this note"
              >
                <Bookmark className="h-4 w-4 text-gray-600" />
              </Button>
            </div>
          )}
        </div>

        {/* Topic/Title with highlighting */}
        {note.topic && (
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{highlightText(note.topic, searchTerm)}</h3>
        )}

        {/* Content excerpt with highlighting */}
        <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
          {highlightText(getExcerpt(note.content), searchTerm)}
        </p>

        {/* Tags */}
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

        {/* Social signals */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5 hover:text-red-500 transition-colors" title="Likes">
              <Heart className="h-4 w-4" />
              <span className="font-medium">{socialSignals.likes}</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-blue-500 transition-colors" title="Replies">
              <MessageCircle className="h-4 w-4" />
              <span className="font-medium">{socialSignals.replies}</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-green-500 transition-colors" title="Views">
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
              onOpen(note.id)
            }}
            title="Open note details"
          >
            Open
            <ExternalLink className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Hover preview indicator */}
      {isHovered && (
        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full shadow-lg animate-in fade-in slide-in-from-top duration-200">
          Click to view
        </div>
      )}
    </Card>
  )
}

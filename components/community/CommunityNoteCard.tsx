"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Heart, MessageCircle, Share2, TrendingUp } from "lucide-react"
import type { CommunityNote } from "@/hooks/use-community-notes"

interface CommunityNoteCardProps {
  readonly note: CommunityNote
  readonly onLike: (noteId: string, note: CommunityNote) => void
  readonly onShare: (note: CommunityNote) => void
  readonly onComment: (noteId: string) => void
}

export const CommunityNoteCard = ({ note, onLike, onShare, onComment }: CommunityNoteCardProps) => {
  return (
    <div className="community-note-hover border rounded-xl p-5 space-y-3 bg-white shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-purple-100">
            <AvatarImage src={note.avatar || "/placeholder.svg"} alt={note.author} />
            <AvatarFallback className="bg-gradient-to-br from-purple-400 to-blue-400 text-white">
              {note.author[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-sm text-gray-900">{note.title}</h4>
            <p className="text-xs text-gray-500">by {note.author}</p>
          </div>
        </div>
        {note.trending && (
          <Badge className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
            <TrendingUp className="h-3 w-3 mr-1" />
            Trending
          </Badge>
        )}
      </div>

      <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{note.content}</p>

      <div className="flex items-center gap-2 flex-wrap">
        {note.tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors"
          >
            #{tag}
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike(note.id, note)}
            className={`gap-1.5 rounded-lg transition-all ${
              note.isLiked ? "text-red-500 bg-red-50 hover:bg-red-100" : "hover:bg-gray-100"
            }`}
          >
            <Heart className={`h-4 w-4 ${note.isLiked ? "fill-current" : ""}`} />
            <span className="font-medium">{note.likes}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all"
            onClick={() => onComment(note.id)}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium">{note.comments}</span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShare(note)}
          className="gap-1.5 rounded-lg hover:bg-purple-50 hover:text-purple-600 transition-all"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>
    </div>
  )
}

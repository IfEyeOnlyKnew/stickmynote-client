// Legacy "note" preview card - the app has transitioned from "notes" to "sticks".
// This component remains for backward compatibility with existing note-based features.
// New features should use stick-based components instead.
"use client"

import React, { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MessageCircle, Expand, Clock, Share2, Palette } from "lucide-react"
import { NotedIcon } from "@/components/noted/NotedIcon"
import type { Note } from "@/types/note"
import { formatDistanceToNow } from "date-fns"
import { COLORS } from "@/utils/noteUtils"
import { stripHtmlTags } from "@/lib/utils"

interface NotePreviewCardProps {
  readonly note: Note
  readonly onClick: () => void
  readonly onUpdateColor?: (noteId: string, color: string) => void
  readonly isLoading?: boolean
}

export const NotePreviewCard: React.FC<NotePreviewCardProps> = ({
  note,
  onClick,
  onUpdateColor,
  isLoading = false,
}) => {
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  // Format the timestamp
  const timeAgo = useMemo(() => {
    try {
      const date = new Date(note.updated_at || note.created_at)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return ""
    }
  }, [note.updated_at, note.created_at])

  // Get display title (topic or title or first line of content)
  const displayTitle = useMemo(() => {
    if (note.topic) return note.topic
    if (note.title) return note.title
    if (note.content) {
      // Strip HTML and get first line
      const stripped = stripHtmlTags(note.content).trim()
      const firstLine = stripped.split("\n")[0]
      return firstLine.length > 60 ? firstLine.substring(0, 60) + "..." : firstLine
    }
    return "Untitled Note"
  }, [note.topic, note.title, note.content])

  // Get content preview (strip HTML, truncate)
  const contentPreview = useMemo(() => {
    if (!note.content) return ""
    const stripped = stripHtmlTags(note.content).trim()
    // Skip first line if it's the same as title
    const lines = stripped.split("\n").filter(Boolean)
    const previewLines = note.topic || note.title ? lines : lines.slice(1)
    const preview = previewLines.join(" ").trim()
    return preview.length > 120 ? preview.substring(0, 120) + "..." : preview
  }, [note.content, note.topic, note.title])

  // Get tags (up to 3)
  const displayTags = useMemo(() => {
    if (!note.tags || !Array.isArray(note.tags)) return []
    return note.tags.slice(0, 3)
  }, [note.tags])

  const remainingTags = (note.tags?.length || 0) - displayTags.length

  // Reply count
  const replyCount = note.replies?.length || 0

  // Border color from note color (use note color for border, white for background)
  const borderColor = note.color || "#e5e7eb" // Default to gray-200 if no color

  const handleColorSelect = (color: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (onUpdateColor) {
      onUpdateColor(note.id, color)
    }
    setColorPickerOpen(false)
  }

  const handleColorPickerClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
  }

  return (
    <Card
      className={`
        relative cursor-pointer transition-all duration-200
        hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1
        overflow-hidden bg-white
        ${isLoading ? "opacity-50 pointer-events-none" : ""}
      `}
      style={{
        borderWidth: "3px",
        borderColor: borderColor,
        borderStyle: "solid"
      }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: Title + Icons */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base leading-tight line-clamp-2 flex-1 text-gray-900">
            {displayTitle}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Color Palette Button */}
            {onUpdateColor && (
              <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={handleColorPickerClick}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Change border color"
                  >
                    <Palette
                      className="w-4 h-4 text-gray-400 hover:text-gray-600"
                      style={{ color: borderColor === "#e5e7eb" ? undefined : borderColor }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-2"
                  align="end"
                  onClick={handleColorPickerClick}
                >
                  <div className="grid grid-cols-4 gap-1">
                    {COLORS.map((color) => (
                      <button
                        type="button"
                        key={color.value}
                        onClick={(e) => handleColorSelect(color.value, e)}
                        className={`
                          w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                          ${note.color === color.value ? "ring-2 ring-offset-1 ring-blue-500" : "border-gray-200"}
                        `}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <button type="button" title="Noted" className="bg-transparent border-none p-0 cursor-pointer" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <NotedIcon
                stickId={note.id}
                stickTopic={note.topic || note.title}
                stickContent={note.content}
                isPersonal={true}
                size="sm"
                className="h-6 w-6 p-0"
              />
            </button>
            <Expand className="w-4 h-4 opacity-50 text-gray-500" />
          </div>
        </div>

        {/* Content preview */}
        {contentPreview && (
          <p className="text-sm leading-relaxed line-clamp-3 mb-3 text-gray-500">
            {contentPreview}
          </p>
        )}

        {/* Tags */}
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {displayTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-900"
              >
                {tag}
              </Badge>
            ))}
            {remainingTags > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500">
                +{remainingTags}
              </Badge>
            )}
          </div>
        )}

        {/* Footer: Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {/* Time */}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>

            {/* Replies */}
            {replyCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {replyCount}
              </span>
            )}
          </div>

          {/* Right side: Shared indicator */}
          <div className="flex items-center gap-2">
            {/* Shared indicator */}
            {note.is_shared && (
              <span className="flex items-center gap-1">
                <Share2 className="w-3 h-3" />
                Shared
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

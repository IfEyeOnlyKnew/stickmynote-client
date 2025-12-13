"use client"

import { useState } from "react"
import { Maximize2, Share2, Lock, Trash2, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColorPalette } from "@/components/ColorPalette"
import { AskAIModal } from "@/components/ai/AskAIModal"
import type React from "react"

interface NoteCardHeaderProps {
  noteId: string
  isShared: boolean
  currentColor?: string
  onOpenFullscreen?: (noteId: string) => void
  onUpdateSharing: (noteId: string, isShared: boolean) => void
  onDeleteNote: (noteId: string) => void
  onColorChange?: (noteId: string, color: string) => void
  onAIAnswerKept?: () => void
}

export const NoteCardHeader: React.FC<NoteCardHeaderProps> = ({
  noteId,
  isShared,
  currentColor = "#ffffff",
  onOpenFullscreen,
  onUpdateSharing,
  onDeleteNote,
  onColorChange,
  onAIAnswerKept,
}) => {
  const [askAIOpen, setAskAIOpen] = useState(false)

  const handleColorChange = (color: string) => {
    if (onColorChange) {
      onColorChange(noteId, color)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {onOpenFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onOpenFullscreen(noteId)
              }}
              className="h-6 w-6 p-0"
              title="Open in fullscreen"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onUpdateSharing(noteId, !isShared)
            }}
            className="h-6 w-6 p-0"
            title={isShared ? "Make private" : "Make shared"}
          >
            {isShared ? <Share2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setAskAIOpen(true)
            }}
            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex-shrink-0"
            title="Ask me a question"
          >
            <HelpCircle className="h-3 w-3" />
          </Button>
          {onColorChange && <ColorPalette currentColor={currentColor} onColorChange={handleColorChange} size="sm" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteNote(noteId)
            }}
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
            title="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* AI Ask Modal */}
      <AskAIModal
        open={askAIOpen}
        onOpenChange={setAskAIOpen}
        stickId={noteId}
        stickType="personal"
        onAnswerKept={onAIAnswerKept}
      />
    </>
  )
}

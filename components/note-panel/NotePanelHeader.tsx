"use client"

import type React from "react"
import { useState } from "react"
import { Share2, Lock, Trash2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AskAIModal } from "@/components/ai/AskAIModal"
import type { Note } from "@/types/note"

interface NotePanelHeaderProps {
  readonly note: Note
  readonly onUpdateSharing: (noteId: string, isShared: boolean) => void
  readonly onDeleteNote: (noteId: string) => void
}

export const NotePanelHeader: React.FC<NotePanelHeaderProps> = ({ note, onUpdateSharing, onDeleteNote }) => {
  const [askAIOpen, setAskAIOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* No fullscreen button in panel mode since it's already a panel view */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onUpdateSharing(note.id, !note.is_shared)
            }}
            className="h-6 w-6 p-0"
            title={note.is_shared ? "Make private" : "Make shared"}
          >
            {note.is_shared ? <Share2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
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
            className="h-6 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-1"
            title="Ask AI a question about this stick"
          >
            <Sparkles className="h-3 w-3" />
            <span className="text-xs font-medium">Ask AI</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteNote(note.id)
            }}
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            title="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Ask AI Modal */}
      <AskAIModal
        open={askAIOpen}
        onOpenChange={setAskAIOpen}
        stickId={note.id}
        stickType="personal"
      />
    </>
  )
}

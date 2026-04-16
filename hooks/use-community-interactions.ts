"use client"

import { useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import type { CommunityNote } from "./use-community-notes"

export const useCommunityInteractions = (updateNote: (noteId: string, updates: Partial<CommunityNote>) => void) => {
  const handleLike = useCallback(
    (noteId: string, currentNote: CommunityNote) => {
      const newIsLiked = !currentNote.isLiked
      const newLikes = newIsLiked ? currentNote.likes + 1 : currentNote.likes - 1

      updateNote(noteId, {
        isLiked: newIsLiked,
        likes: newLikes,
      })

      toast({
        title: newIsLiked ? "Note liked!" : "Like removed",
        description: "Your interaction has been recorded.",
      })
    },
    [updateNote],
  )

  const handleShare = useCallback((note: CommunityNote) => {
    navigator.clipboard.writeText(`Check out this note: ${note.title}`)
    toast({
      title: "Link copied!",
      description: "Note link has been copied to clipboard.",
    })
  }, [])

  // Demo community panel (control-panel/) has no comment backend of its own.
  // Real discussions live on sticks/pads/concur via their own reply APIs.
  // This handler shows a toast instead of silently no-oping so the card click
  // still gives feedback.
  const handleComment = useCallback((_noteId: string) => {
    toast({
      title: "Comments are on individual sticks",
      description: "Open a stick to leave a reply or join its discussion.",
    })
  }, [])

  return {
    handleLike,
    handleShare,
    handleComment,
  }
}

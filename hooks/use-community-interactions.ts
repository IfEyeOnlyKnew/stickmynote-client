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

  const handleComment = useCallback((noteId: string) => {
    // TODO: Implement comment functionality
    toast({
      title: "Comments coming soon!",
      description: "Comment functionality will be available soon.",
    })
  }, [])

  return {
    handleLike,
    handleShare,
    handleComment,
  }
}

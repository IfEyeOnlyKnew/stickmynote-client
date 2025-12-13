"use client"

import type React from "react"

import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import type { Note } from "@/types/note"

interface UseNotesActionsProps {
  allNotes: Note[]
  setAllNotes: React.Dispatch<React.SetStateAction<Note[]>>
  handleUpdateNote: (noteId: string, updates: Partial<Note>) => Promise<void>
  handleDeleteNote: (noteId: string, onSuccess: () => void) => Promise<void>
  handleGenerateTags: (noteId: string, topic: string, content: string) => Promise<void>
  addToDeletedNotes: (note: Note) => void
  setGeneratingTags: React.Dispatch<React.SetStateAction<string | null>>
}

interface UseNotesActionsReturn {
  handleNoteContentChange: (noteId: string, content: string) => void
  handleNoteTopicChange: (noteId: string, topic: string) => void
  handleUpdateNoteSharing: (noteId: string, isShared: boolean) => Promise<void>
  handleUpdateNotePosition: (noteId: string, position: { x: number; y: number }) => Promise<void>
  handleUpdateNoteColor: (noteId: string, color: string) => Promise<void>
  handleDeleteNoteWithUndo: (noteId: string) => void
  handleGenerateTagsWithToast: (noteId: string, topic: string, content: string) => Promise<void>
}

export function useNotesActions({
  allNotes,
  setAllNotes,
  handleUpdateNote,
  handleDeleteNote,
  handleGenerateTags,
  addToDeletedNotes,
  setGeneratingTags,
}: UseNotesActionsProps): UseNotesActionsReturn {
  const { toast } = useToast()

  const handleNoteContentChange = useCallback(
    (noteId: string, content: string) => {
      setAllNotes((prev) =>
        prev.map((note) => (note.id === noteId ? { ...note, content, updated_at: new Date().toISOString() } : note)),
      )
    },
    [setAllNotes],
  )

  const handleNoteTopicChange = useCallback(
    (noteId: string, topic: string) => {
      setAllNotes((prev) =>
        prev.map((note) => (note.id === noteId ? { ...note, topic, updated_at: new Date().toISOString() } : note)),
      )
    },
    [setAllNotes],
  )

  const handleUpdateNoteSharing = useCallback(
    async (noteId: string, isShared: boolean) => {
      try {
        await handleUpdateNote(noteId, { is_shared: isShared })
        toast({
          title: isShared ? "Note Shared" : "Note Made Private",
          description: isShared ? "Your note is now visible to others." : "Your note is now private.",
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update sharing"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    },
    [handleUpdateNote, toast],
  )

  const handleUpdateNotePosition = useCallback(
    async (noteId: string, position: { x: number; y: number }) => {
      try {
        await handleUpdateNote(noteId, {
          position_x: position.x,
          position_y: position.y,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update position"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    },
    [handleUpdateNote, toast],
  )

  const handleUpdateNoteColor = useCallback(
    async (noteId: string, color: string) => {
      try {
        await handleUpdateNote(noteId, { color })
        toast({
          title: "Color Updated",
          description: "Note color has been changed successfully.",
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update color"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    },
    [handleUpdateNote, toast],
  )

  const handleDeleteNoteWithUndo = useCallback(
    (noteId: string) => {
      const noteToDelete = allNotes.find((note) => note.id === noteId)
      if (!noteToDelete) return

      addToDeletedNotes(noteToDelete)
      setAllNotes((prev) => prev.filter((note) => note.id !== noteId))

      setTimeout(async () => {
        try {
          await handleDeleteNote(noteId, () => {
            console.log("Note permanently deleted:", noteId)
          })
        } catch (err) {
          console.error("Error in permanent delete:", err)
        }
      }, 10000)

      toast({
        title: "Note Deleted",
        description: "Note moved to trash. You can undo this action.",
      })
    },
    [allNotes, addToDeletedNotes, setAllNotes, handleDeleteNote, toast],
  )

  const handleGenerateTagsWithToast = useCallback(
    async (noteId: string, topic: string, content: string) => {
      try {
        setGeneratingTags(noteId)
        await handleGenerateTags(noteId, topic, content)
        toast({
          title: "Links Generated & Saved",
          description: "Found and saved links for your note topic.",
        })
      } catch (err) {
        console.error("Error generating tags:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to generate tags"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setGeneratingTags(null)
      }
    },
    [handleGenerateTags, setGeneratingTags, toast],
  )

  return {
    handleNoteContentChange,
    handleNoteTopicChange,
    handleUpdateNoteSharing,
    handleUpdateNotePosition,
    handleUpdateNoteColor,
    handleDeleteNoteWithUndo,
    handleGenerateTagsWithToast,
  }
}

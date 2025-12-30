"use client"

import type React from "react"

import { useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import type { Note } from "@/types/note"
import { useNotesData } from "./useNotesData"
import { useNotesState } from "./useNotesState"
import { useNotesActions } from "./useNotesActions"

// ============================================================================
// TYPES
// ============================================================================

interface UseNotesReturn {
  allNotes: Note[]
  setAllNotes: React.Dispatch<React.SetStateAction<Note[]>>
  loading: boolean
  loadingMore: boolean
  error: string | null
  deletedNotes: Note[]
  showUndoBar: boolean
  generatingTags: string | null
  highestZIndex: number
  setHighestZIndex: React.Dispatch<React.SetStateAction<number>>
  handleCreateNote: (color: string, windowSize: { width: number; height: number }) => Promise<Note>
  loadMoreNotes: () => Promise<void>
  handleNoteContentChange: (noteId: string, content: string) => void
  handleNoteTopicChange: (noteId: string, topic: string) => void
  handleUpdateNote: (noteId: string, updates: Partial<Note>) => Promise<void>
  handleUpdateNoteSharing: (noteId: string, isShared: boolean) => Promise<void>
  handleUpdateNotePosition: (noteId: string, position: { x: number; y: number }) => Promise<void>
  handleUpdateNoteColor: (noteId: string, color: string) => Promise<void>
  handleDeleteNote: (noteId: string) => void
  handleUndoDelete: () => void
  handleClearUndo: () => void
  clearAllNotes: () => void
  handleGenerateTags: (noteId: string, topic: string) => Promise<void>
  hasMore: boolean
  markInitialized: () => void
}

// ============================================================================
// MAIN COORDINATOR HOOK
// ============================================================================

export function useNotes(userId: string | null, shouldLoad = true): UseNotesReturn {
  const { toast } = useToast()

  const data = useNotesData(userId, shouldLoad)
  const state = useNotesState()
  const actions = useNotesActions({
    allNotes: data.allNotes,
    setAllNotes: data.setAllNotes,
    handleUpdateNote: data.handleUpdateNote,
    handleDeleteNote: data.handleDeleteNote,
    handleGenerateTags: data.handleGenerateTags,
    addToDeletedNotes: state.addToDeletedNotes,
    setGeneratingTags: state.setGeneratingTags,
  })

  useEffect(() => {
    if (userId && shouldLoad) {
      state.setLoading(true)
      state.setError(null)
      data
        .loadNotes()
        .then(() => {
          state.setLoading(false)
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : "Failed to load notes"
          state.setError(errorMessage)
          state.setLoading(false)
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, shouldLoad])

  const loadMoreNotes = useCallback(async () => {
    if (!data.hasMore || data.isLoadingMore) return

    try {
      await data.loadNotes(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load more notes"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [data.hasMore, data.isLoadingMore, data.loadNotes, toast])
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  const handleCreateNote = useCallback(
    async (color: string, windowSize: { width: number; height: number }): Promise<Note> => {
      try {
        const newNote = await data.handleCreateNote(color, windowSize, state.highestZIndex)
        state.setHighestZIndex(state.highestZIndex + 1)
        toast({
          title: "Stick Created",
          description: "Your new Stick has been created successfully.",
        })
        return newNote
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create note"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw err
      }
    },
    [data.handleCreateNote, state.highestZIndex, state.setHighestZIndex, toast],
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  const handleUndoDelete = useCallback(() => {
    const restoredNotes = state.handleUndoDelete()
    data.setAllNotes((prev) => [...restoredNotes, ...prev])
    toast({
      title: "Sticks Restored",
      description: `${restoredNotes.length} Stick(s) have been restored.`,
    })
  }, [state.handleUndoDelete, data.setAllNotes, toast])
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  const clearAllNotes = useCallback(async () => {
    try {
      await data.clearAllNotes()
      state.handleClearUndo()
      toast({
        title: "All Sticks Cleared",
        description: "All your Sticks have been permanently deleted.",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to clear notes"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }, [data.clearAllNotes, state.handleClearUndo, toast])
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  const handleGenerateTags = useCallback(
    async (noteId: string, topic: string): Promise<void> => {
      try {
        state.setGeneratingTags(noteId)
        await data.handleGenerateTags(noteId, topic)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to generate tags"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        state.setGeneratingTags(null)
      }
    },
    [data.handleGenerateTags, state.setGeneratingTags, toast],
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    allNotes: data.allNotes,
    setAllNotes: data.setAllNotes,
    loading: state.loading,
    loadingMore: data.isLoadingMore, // Use isLoadingMore from data hook
    error: state.error,
    deletedNotes: state.deletedNotes,
    showUndoBar: state.showUndoBar,
    generatingTags: state.generatingTags,
    highestZIndex: state.highestZIndex,
    setHighestZIndex: state.setHighestZIndex,
    handleCreateNote,
    loadMoreNotes,
    handleNoteContentChange: actions.handleNoteContentChange,
    handleNoteTopicChange: actions.handleNoteTopicChange,
    handleUpdateNote: data.handleUpdateNote,
    handleUpdateNoteSharing: actions.handleUpdateNoteSharing,
    handleUpdateNotePosition: actions.handleUpdateNotePosition,
    handleUpdateNoteColor: actions.handleUpdateNoteColor,
    handleDeleteNote: actions.handleDeleteNoteWithUndo,
    handleUndoDelete,
    handleClearUndo: state.handleClearUndo,
    clearAllNotes,
    handleGenerateTags,
    hasMore: data.hasMore, // Expose hasMore
    markInitialized: data.markInitialized, // Mark as initialized when using SSR data
  }
}

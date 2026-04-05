"use client"

import type React from "react"

import { useState, useCallback } from "react"
import type { Note } from "@/types/note"

interface UseNotesStateReturn {
  loading: boolean
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  loadingMore: boolean
  setLoadingMore: React.Dispatch<React.SetStateAction<boolean>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  deletedNotes: Note[]
  showUndoBar: boolean
  generatingTags: string | null
  setGeneratingTags: React.Dispatch<React.SetStateAction<string | null>>
  highestZIndex: number
  setHighestZIndex: React.Dispatch<React.SetStateAction<number>>
  handleUndoDelete: () => Note[]
  handleClearUndo: () => void
  addToDeletedNotes: (note: Note) => void
}

export function useNotesState(): UseNotesStateReturn {
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([])
  const [showUndoBar, setShowUndoBar] = useState(false)
  const [generatingTags, setGeneratingTags] = useState<string | null>(null)
  const [highestZIndex, setHighestZIndex] = useState(1)

  const expireDeletedNote = useCallback(
    (noteId: string) => {
      setDeletedNotes((prev) => prev.filter((n) => n.id !== noteId))
      setShowUndoBar((current) => {
        const remaining = deletedNotes.filter((n) => n.id !== noteId)
        return remaining.length > 0
      })
    },
    [deletedNotes],
  )

  const addToDeletedNotes = useCallback(
    (note: Note) => {
      setDeletedNotes((prev) => [...prev, note])
      setShowUndoBar(true)

      setTimeout(() => expireDeletedNote(note.id), 10000)
    },
    [expireDeletedNote],
  )

  const handleUndoDelete = useCallback(() => {
    const notesToRestore = deletedNotes
    setDeletedNotes([])
    setShowUndoBar(false)
    return notesToRestore
  }, [deletedNotes])

  const handleClearUndo = useCallback(() => {
    setDeletedNotes([])
    setShowUndoBar(false)
  }, [])

  return {
    loading,
    setLoading,
    loadingMore,
    setLoadingMore,
    error,
    setError,
    deletedNotes,
    showUndoBar,
    generatingTags,
    setGeneratingTags,
    highestZIndex,
    setHighestZIndex,
    handleUndoDelete,
    handleClearUndo,
    addToDeletedNotes,
  }
}

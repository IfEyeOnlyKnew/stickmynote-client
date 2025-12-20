"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/contexts/user-context"

export interface CommunityNote {
  id: string
  title: string
  content: string
  author: string
  authorId: string
  avatar: string
  likes: number
  comments: number
  tags: string[]
  isLiked: boolean
  trending: boolean
  createdAt: string
}

export const useCommunityNotes = () => {
  const { user } = useUser()
  const [notes, setNotes] = useState<CommunityNote[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadNotes = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/community-notes")
      if (!response.ok) {
        console.error("Error fetching community notes")
        setNotes([])
        return
      }

      const data = await response.json()
      setNotes(data.notes || [])
    } catch (error) {
      console.error("Error loading community notes:", error)
      setNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const updateNote = (noteId: string, updates: Partial<CommunityNote>) => {
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, ...updates } : note)))
  }

  const refreshNotes = async () => {
    await loadNotes()
  }

  return {
    notes,
    isLoading,
    updateNote,
    refreshNotes,
  }
}

"use client"

import type React from "react"
import { useRef, useState, useCallback } from "react"
import type { Note } from "@/types/note"

interface PersonalStick {
  id: string
  user_id: string
  topic?: string
  content?: string
  color?: string
  position_x?: number
  position_y?: number
  is_shared?: boolean
  created_at?: string
  updated_at?: string
}

interface TabRow {
  personal_stick_id: string
  tags: string | string[]
}

interface ReplyRow {
  id: string
  content: string
  color: string
  created_at: string
  updated_at?: string
  user_id: string
  personal_stick_id: string
}

interface UseNotesDataReturn {
  allNotes: Note[]
  setAllNotes: React.Dispatch<React.SetStateAction<Note[]>>
  hasMore: boolean
  offset: number
  isLoadingMore: boolean
  loadNotes: (isLoadMore?: boolean) => Promise<void>
  markInitialized: () => void
  handleCreateNote: (
    color: string,
    windowSize: { width: number; height: number },
    highestZIndex: number,
  ) => Promise<Note>
  handleUpdateNote: (noteId: string, updates: Partial<Note>) => Promise<void>
  handleDeleteNote: (noteId: string, onSuccess: () => void) => Promise<void>
  clearAllNotes: () => Promise<void>
  handleGenerateTags: (noteId: string, topic: string) => Promise<void>
}

// API helper functions
async function fetchNotes(userId: string, limit: number, offset: number) {
  const res = await fetch(`/api/v2/notes?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error('Failed to fetch notes')
  return res.json()
}

async function createNote(data: Partial<PersonalStick>) {
  const res = await fetch('/api/v2/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create note')
  return res.json()
}

async function updateNote(noteId: string, updates: Record<string, unknown>) {
  const res = await fetch(`/api/v2/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update note')
  return res.json()
}

async function deleteNote(noteId: string) {
  const res = await fetch(`/api/v2/notes/${noteId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete note')
  return res.json()
}

async function deleteAllNotes() {
  const res = await fetch('/api/v2/notes/all', {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete all notes')
  return res.json()
}

// Helper: Parse hyperlinks from tab
function parseHyperlinksFromTab(tab: TabRow): { url: string; title?: string }[] {
  try {
    if (Array.isArray(tab.tags)) return tab.tags as any
    if (typeof tab.tags === "string") return JSON.parse(tab.tags || "[]")
    return []
  } catch {
    return []
  }
}

// Helper: Build hyperlinks map from tabs
function buildHyperlinksMap(tabs: TabRow[]): Map<string, { url: string; title?: string }[]> {
  const map = new Map<string, { url: string; title?: string }[]>()
  for (const tab of tabs || []) {
    map.set(tab.personal_stick_id, parseHyperlinksFromTab(tab))
  }
  return map
}

// Helper: Build replies map
function buildRepliesMap(replies: ReplyRow[]): Map<string, ReplyRow[]> {
  const map = new Map<string, ReplyRow[]>()
  for (const reply of replies || []) {
    const arr = map.get(reply.personal_stick_id) || []
    arr.push(reply)
    map.set(reply.personal_stick_id, arr)
  }
  return map
}

// Helper: Transform raw note to Note type
function transformNote(
  note: PersonalStick,
  hyperlinksByNoteId: Map<string, { url: string; title?: string }[]>,
  repliesByNoteId: Map<string, ReplyRow[]>
): Note {
  const noteReplies = repliesByNoteId.get(note.id) || []
  return {
    id: note.id,
    topic: note.topic || "",
    title: note.topic || "",
    content: note.content || "",
    color: note.color || "#fef3c7",
    position_x: note.position_x || 0,
    position_y: note.position_y || 0,
    is_shared: Boolean(note.is_shared),
    hyperlinks: hyperlinksByNoteId.get(note.id) || [],
    tags: [],
    videos: [],
    images: [],
    created_at: note.created_at || new Date().toISOString(),
    updated_at: note.updated_at || new Date().toISOString(),
    user_id: note.user_id,
    replies: noteReplies.map((reply) => ({
      id: reply.id,
      content: reply.content || "",
      color: reply.color || "#ffffff",
      created_at: reply.created_at,
      updated_at: reply.updated_at || reply.created_at,
      user_id: reply.user_id,
      note_id: reply.personal_stick_id,
    })),
    z_index: 1,
  }
}

// Helper: Transform and deduplicate notes for load more
function deduplicateNotes(prevNotes: Note[], newNotes: Note[]): Note[] {
  const existingIds = new Set(prevNotes.map(n => n.id))
  const uniqueNewNotes = newNotes.filter(n => !existingIds.has(n.id))
  return [...prevNotes, ...uniqueNewNotes]
}

// Helper: Check if we should skip loading
function shouldSkipLoad(
  userId: string | null,
  shouldLoad: boolean,
  isLoadMore: boolean,
  isLoadingMore: boolean,
  hasInitialLoaded: boolean
): boolean {
  if (!userId || !shouldLoad) return true
  if (!isLoadMore && hasInitialLoaded) return true
  if (isLoadMore && isLoadingMore) return true
  return false
}

export function useNotesData(userId: string | null, shouldLoad = true): UseNotesDataReturn {
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const hasInitialLoadedRef = useRef(false)

  const loadNotes = useCallback(
    async (isLoadMore = false) => {
      if (shouldSkipLoad(userId, shouldLoad, isLoadMore, isLoadingMore, hasInitialLoadedRef.current)) {
        return
      }

      try {
        if (isLoadMore) {
          setIsLoadingMore(true)
        }

        const currentOffset = isLoadMore ? offset : 0
        const limit = 20

        // Fetch notes via API
        const { notes: rawNotes, total, tabs, replies } = await fetchNotes(userId!, limit, currentOffset)

        if (!rawNotes || rawNotes.length === 0) {
          if (isLoadMore) {
            setHasMore(false)
          } else {
            setAllNotes([])
            setOffset(0)
          }
          return
        }

        // Build lookup maps and transform notes
        const hyperlinksByNoteId = buildHyperlinksMap(tabs || [])
        const repliesByNoteId = buildRepliesMap(replies || [])
        const notesWithReplies = rawNotes.map((note: PersonalStick) =>
          transformNote(note, hyperlinksByNoteId, repliesByNoteId)
        )

        // Update state based on load type
        if (isLoadMore) {
          setAllNotes((prev) => deduplicateNotes(prev, notesWithReplies))
          setOffset((prev) => prev + limit)
        } else {
          setAllNotes(notesWithReplies)
          setOffset(limit)
          hasInitialLoadedRef.current = true
        }

        setHasMore(rawNotes.length === limit && total > currentOffset + limit)
      } catch (err) {
        console.error("Error in loadNotes:", err)
        throw err
      } finally {
        if (isLoadMore) {
          setIsLoadingMore(false)
        }
      }
    },
    [userId, shouldLoad, offset, isLoadingMore],
  )

  const handleCreateNote = useCallback(
    async (color: string, windowSize: { width: number; height: number }, highestZIndex: number): Promise<Note> => {
      if (!userId) {
        throw new Error("User not authenticated")
      }

      try {
        const NOTE_WIDTH = 400
        const position_x = Math.max(0, (windowSize.width - NOTE_WIDTH) / 2)
        const position_y = 40
        const newZIndex = highestZIndex + 1

        // Create note via API
        const { note } = await createNote({
          user_id: userId,
          topic: "Untitled Note",
          content: "",
          color,
          position_x,
          position_y,
          is_shared: false,
        })

        if (!note) {
          throw new Error("Note was not created")
        }

        const newNote: Note = {
          id: note.id,
          topic: note.topic || "",
          title: note.topic || "",
          content: note.content || "",
          color: note.color || "#fef3c7",
          position_x: note.position_x || 0,
          position_y: note.position_y || 0,
          is_shared: Boolean(note.is_shared),
          hyperlinks: [],
          tags: [],
          videos: [],
          images: [],
          created_at: note.created_at,
          updated_at: note.updated_at,
          user_id: note.user_id,
          replies: [],
          z_index: newZIndex,
        }

        setAllNotes((prev) => [newNote, ...prev])
        return newNote
      } catch (err) {
        console.error("Error in handleCreateNote:", err)
        throw err
      }
    },
    [userId],
  )

  const handleUpdateNote = useCallback(
    async (noteId: string, updates: Partial<Note>) => {
      if (!userId) return

      try {
        const updatePayload: Partial<PersonalStick> = {}

        if (updates.topic !== undefined) updatePayload.topic = updates.topic
        if (updates.content !== undefined) updatePayload.content = updates.content
        if (updates.color !== undefined) updatePayload.color = updates.color
        if (updates.position_x !== undefined) updatePayload.position_x = updates.position_x
        if (updates.position_y !== undefined) updatePayload.position_y = updates.position_y
        if (updates.is_shared !== undefined) updatePayload.is_shared = Boolean(updates.is_shared)

        // Update note via API
        await updateNote(noteId, updatePayload)

        setAllNotes((prev) =>
          prev.map((note) =>
            note.id === noteId ? { ...note, ...updates, updated_at: new Date().toISOString() } : note,
          ),
        )
      } catch (err) {
        console.error("Error in handleUpdateNote:", err)
        throw err
      }
    },
    [userId],
  )

  const handleDeleteNote = useCallback(
    async (noteId: string, onSuccess: () => void) => {
      if (!userId) return

      try {
        // Delete note via API
        await deleteNote(noteId)
        onSuccess()
      } catch (err) {
        console.error("Error in permanent delete:", err)
        throw err
      }
    },
    [userId],
  )

  const clearAllNotes = useCallback(async () => {
    if (!userId) return

    const confirmed = globalThis.confirm("Are you sure you want to delete ALL your notes? This action cannot be undone.")
    if (!confirmed) return

    try {
      // Delete all notes via API
      await deleteAllNotes()
      setAllNotes([])
    } catch (err) {
      console.error("Error in clearAllNotes:", err)
      throw err
    }
  }, [userId])

  const handleGenerateTags = useCallback(
    async (noteId: string, topic: string) => {
      if (!userId) return

      try {
        // Generate tags via API - the API handles all the database operations
        const res = await fetch("/api/generate-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, noteId }),
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`API error: ${errorText}`)
        }

        const { hyperlinks } = await res.json()

        setAllNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, hyperlinks } : note)))
      } catch (err) {
        console.error("Error generating tags:", err)
        throw err
      }
    },
    [userId],
  )

  // Mark the initial load as complete (used when initialNotes are provided from SSR)
  const markInitialized = useCallback(() => {
    hasInitialLoadedRef.current = true
  }, [])

  return {
    allNotes,
    setAllNotes,
    hasMore,
    offset,
    isLoadingMore,
    loadNotes,
    markInitialized,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    clearAllNotes,
    handleGenerateTags,
  }
}

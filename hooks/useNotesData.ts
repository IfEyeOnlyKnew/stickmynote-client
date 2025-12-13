"use client"

import type React from "react"
import { useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/types/note"

interface UseNotesDataReturn {
  allNotes: Note[]
  setAllNotes: React.Dispatch<React.SetStateAction<Note[]>>
  hasMore: boolean
  offset: number
  isLoadingMore: boolean
  loadNotes: (isLoadMore?: boolean) => Promise<void>
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

export function useNotesData(userId: string | null, shouldLoad = true): UseNotesDataReturn {
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const hasInitialLoadedRef = useRef(false)

  const loadNotes = useCallback(
    async (isLoadMore = false) => {
      if (!userId || !shouldLoad) {
        return
      }

      if (!isLoadMore && hasInitialLoadedRef.current) {
        return
      }

      if (isLoadMore && isLoadingMore) {
        return
      }

      try {
        if (isLoadMore) {
          setIsLoadingMore(true)
        }

        const supabase = createClient()
        const currentOffset = isLoadMore ? offset : 0
        const limit = 20

        const notesQuery = supabase
          .from("personal_sticks")
          .select(
            `
            id, topic, content, color, position_x, position_y, is_shared,
            created_at, updated_at, user_id
          `,
            { count: "exact" },
          )
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .range(currentOffset, currentOffset + limit - 1)

        const { data: notes, error: notesError, count } = await notesQuery

        if (notesError) {
          console.error("Database error fetching notes:", notesError)
          throw new Error(`Failed to fetch notes: ${notesError.message}`)
        }

        type NoteRow = {
          id: string
          topic: string | null
          content: string | null
          color: string | null
          position_x: number | null
          position_y: number | null
          is_shared: boolean | null
          created_at: string
          updated_at: string
          user_id: string
        }

        const typedNotes = (notes as NoteRow[] | null) || []
        const noteIds = typedNotes.map((n) => n.id)
        let noteTabs: Array<{ personal_stick_id: string; tags: string | string[] }> = []
        if (noteIds.length > 0) {
          const { data: tabsData, error: tabsError } = await supabase
            .from("personal_sticks_tabs")
            .select("personal_stick_id, tags")
            .in("personal_stick_id", noteIds)
            .eq("tab_name", "Tags")

          if (tabsError) {
            console.error("Error fetching personal_sticks_tabs:", tabsError)
            throw new Error(`Failed to fetch personal_sticks_tabs: ${tabsError.message}`)
          }
          noteTabs = (tabsData as Array<{ personal_stick_id: string; tags: string | string[] }>) || []
        }

        const hyperlinksByNoteId = new Map<string, { url: string; title?: string }[]>()
        noteTabs.forEach((tab) => {
          try {
            const hyperlinks = Array.isArray(tab.tags)
              ? tab.tags
              : typeof tab.tags === "string"
                ? JSON.parse(tab.tags || "[]")
                : []
            hyperlinksByNoteId.set(tab.personal_stick_id, hyperlinks)
          } catch (err) {
            console.warn(`Failed to parse tags for note ${tab.personal_stick_id}:`, err)
            hyperlinksByNoteId.set(tab.personal_stick_id, [])
          }
        })

        const rawNotes = typedNotes
        if (rawNotes.length === 0) {
          if (isLoadMore) {
            setHasMore(false)
          } else {
            setAllNotes([])
            setOffset(0)
          }
          return
        }

        const filteredNotes = rawNotes
        const { data: allReplies, error: batchRepliesError } = await supabase
          .from("personal_sticks_replies")
          .select(`id, content, color, created_at, user_id, personal_stick_id`)
          .in("personal_stick_id", noteIds)
          .order("created_at", { ascending: true })

        if (batchRepliesError) {
          console.error("Error batch fetching replies:", batchRepliesError)
        }

        type ReplyRow = {
          id: string
          content: string
          color: string
          created_at: string
          updated_at?: string
          user_id: string
          personal_stick_id: string
        }

        const repliesByNoteId = new Map<string, ReplyRow[]>()
        const repliesData = (allReplies as ReplyRow[]) || []
        for (const r of repliesData) {
          const arr = repliesByNoteId.get(r.personal_stick_id) || []
          arr.push(r)
          repliesByNoteId.set(r.personal_stick_id, arr)
        }

        const notesWithReplies = filteredNotes.map((note) => {
          const replies = repliesByNoteId.get(note.id) || []
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
            created_at: note.created_at,
            updated_at: note.updated_at,
            user_id: note.user_id,
            replies: replies.map((reply) => ({
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
        })

        if (isLoadMore) {
          setAllNotes((prev) => [...prev, ...notesWithReplies])
          setOffset((prev) => prev + limit)
        } else {
          setAllNotes(notesWithReplies)
          setOffset(limit)
          hasInitialLoadedRef.current = true
        }

        setHasMore(rawNotes.length === limit && (count || 0) > currentOffset + limit)
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
        const supabase = createClient()
        const NOTE_WIDTH = 400
        const position_x = Math.max(0, (windowSize.width - NOTE_WIDTH) / 2)
        const position_y = 40
        const newZIndex = highestZIndex + 1

        const insertNoteData = {
          user_id: userId,
          topic: "Untitled Note",
          content: "",
          color,
          position_x,
          position_y,
          is_shared: false,
        }

        const { data: note, error } = await (supabase as any)
          .from("personal_sticks")
          .insert(insertNoteData)
          .select(`id, topic, content, color, position_x, position_y, is_shared, created_at, updated_at, user_id`)
          .single()

        if (error) {
          console.error("Error creating note:", error)
          throw new Error(`Failed to create note: ${error.message}`)
        }

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
        const supabase = createClient()

        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }

        if (updates.topic !== undefined) updatePayload.topic = updates.topic
        if (updates.content !== undefined) updatePayload.content = updates.content
        if (updates.color !== undefined) updatePayload.color = updates.color
        if (updates.position_x !== undefined) updatePayload.position_x = updates.position_x
        if (updates.position_y !== undefined) updatePayload.position_y = updates.position_y
        if (updates.is_shared !== undefined) updatePayload.is_shared = Boolean(updates.is_shared)

        const { error } = await (supabase as any)
          .from("personal_sticks")
          .update(updatePayload)
          .eq("id", noteId)
          .eq("user_id", userId)

        if (error) {
          console.error("Error updating note:", error)
          throw new Error(`Failed to update note: ${error.message}`)
        }

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
        const supabase = createClient()
        const { error } = await supabase.from("personal_sticks").delete().eq("id", noteId).eq("user_id", userId)

        if (error) {
          console.error("Error deleting note from database:", error)
          throw error
        }

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

    const confirmed = window.confirm("Are you sure you want to delete ALL your notes? This action cannot be undone.")
    if (!confirmed) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("personal_sticks").delete().eq("user_id", userId)

      if (error) {
        console.error("Error clearing all notes:", error)
        throw new Error(`Failed to clear notes: ${error.message}`)
      }

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
        const supabase = createClient()

        const { data: noteData, error: noteError } = await (supabase as any)
          .from("personal_sticks")
          .select("user_id")
          .eq("id", noteId)
          .single()

        if (noteError || !noteData || noteData.user_id !== userId) {
          throw new Error("You can only generate tags for your own notes")
        }

        const { data: tabRows, error: tabFetchError } = await supabase
          .from("personal_sticks_tabs")
          .select("id")
          .eq("personal_stick_id", noteId)
          .eq("tab_name", "Tags")

        if (tabFetchError) {
          console.error("Error fetching personal_sticks_tabs row:", tabFetchError)
          throw new Error(`Failed to check personal_sticks_tabs: ${tabFetchError.message}`)
        }

        if (!tabRows || tabRows.length === 0) {
          const { error: insertError } = await (supabase as any).from("personal_sticks_tabs").insert({
            personal_stick_id: noteId,
            user_id: userId,
            tab_name: "Tags",
            tab_type: "content",
            tab_content: "",
            tab_data: {},
            tab_order: 99,
            tags: JSON.stringify([]),
          })

          if (insertError) {
            console.error("Error inserting personal_sticks_tabs row:", insertError)
            throw new Error(`Failed to create Tags tab: ${insertError.message}`)
          }
        }

        const { error: clearError } = await (supabase as any)
          .from("personal_sticks_tabs")
          .update({ tags: JSON.stringify([]) })
          .eq("personal_stick_id", noteId)
          .eq("tab_name", "Tags")

        if (clearError) {
          console.error("Error clearing personal_sticks_tabs tags:", clearError)
          throw new Error(`Failed to clear tags: ${clearError.message}`)
        }

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

        const { data: updateData, error: updateError } = await (supabase as any)
          .from("personal_sticks_tabs")
          .update({
            tags: JSON.stringify(hyperlinks),
            updated_at: new Date().toISOString(),
          })
          .eq("personal_stick_id", noteId)
          .eq("tab_name", "Tags")
          .select("id, tags")

        if (updateError) {
          console.error("Error updating personal_sticks_tabs tags:", updateError)
          throw new Error(`Failed to save hyperlinks: ${updateError.message}`)
        }

        if (!updateData || updateData.length === 0) {
          throw new Error("No Tags tab was updated - this shouldn't happen")
        }

        setAllNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, hyperlinks } : note)))
      } catch (err) {
        console.error("Error generating tags:", err)
        throw err
      }
    },
    [userId],
  )

  return {
    allNotes,
    setAllNotes,
    hasMore,
    offset,
    isLoadingMore,
    loadNotes,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    clearAllNotes,
    handleGenerateTags,
  }
}

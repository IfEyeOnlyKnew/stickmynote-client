"use client"

import { useMemo, useState } from "react"
import type { Note } from "@/types/note"

interface SearchStats {
  totalResults: number
  searchTime: number
}

interface UseNoteSearchReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredNotes: Note[]
  searchStats: SearchStats
}

export function useNoteSearchSimple(
  notes: Note[] = [],
  filter: "all" | "personal" | "shared" = "all",
): UseNoteSearchReturn {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredNotes = useMemo(() => {
    if (!Array.isArray(notes)) {
      return []
    }

    // Apply filter first
    let notesToFilter: Note[] = []
    switch (filter) {
      case "personal":
        notesToFilter = notes.filter((note) => !note.is_shared)
        break
      case "shared":
        notesToFilter = notes.filter((note) => note.is_shared)
        break
      case "all":
      default:
        notesToFilter = notes
        break
    }

    // Apply search if query exists
    if (!searchQuery?.trim()) {
      return notesToFilter
    }

    const searchLower = searchQuery.toLowerCase().trim()
    const filtered = notesToFilter.filter((note) => {
      const topicMatch = (note.topic || "").toLowerCase().includes(searchLower)
      const contentMatch = (note.content || "").toLowerCase().includes(searchLower)
      const tagsMatch = Array.isArray(note.tags)
        ? note.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        : false

      return topicMatch || contentMatch || tagsMatch
    })

    return filtered
  }, [notes, searchQuery, filter])

  const searchStats = useMemo(() => {
    const startTime = performance.now()
    const endTime = performance.now()

    return {
      totalResults: filteredNotes.length,
      searchTime: Math.round(endTime - startTime),
    }
  }, [filteredNotes])

  return {
    searchQuery,
    setSearchQuery,
    filteredNotes,
    searchStats,
  }
}

// Legacy export for backward compatibility
export function useNoteSearch(notes: Note[] = [], searchTerm = "", filter: "all" | "personal" | "shared" = "all") {
  return useMemo(() => {
    const startTime = performance.now()

    if (!Array.isArray(notes)) {
      return {
        filteredNotes: [],
        searchStats: { totalResults: 0, searchTime: 0 },
      }
    }

    // Apply filter first
    let notesToFilter: Note[] = []
    switch (filter) {
      case "personal":
        notesToFilter = notes.filter((note) => !note.is_shared)
        break
      case "shared":
        notesToFilter = notes.filter((note) => note.is_shared)
        break
      case "all":
      default:
        notesToFilter = notes
        break
    }

    // Apply search if term exists
    if (!searchTerm?.trim()) {
      const endTime = performance.now()
      return {
        filteredNotes: notesToFilter,
        searchStats: {
          totalResults: notesToFilter.length,
          searchTime: Math.round(endTime - startTime),
        },
      }
    }

    const searchLower = searchTerm.toLowerCase().trim()
    const filtered = notesToFilter.filter((note) => {
      const topicMatch = (note.topic || "").toLowerCase().includes(searchLower)
      const contentMatch = (note.content || "").toLowerCase().includes(searchLower)
      const tagsMatch = Array.isArray(note.tags)
        ? note.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        : false

      return topicMatch || contentMatch || tagsMatch
    })

    const endTime = performance.now()

    return {
      filteredNotes: filtered,
      searchStats: {
        totalResults: filtered.length,
        searchTime: Math.round(endTime - startTime),
      },
    }
  }, [notes, searchTerm, filter])
}

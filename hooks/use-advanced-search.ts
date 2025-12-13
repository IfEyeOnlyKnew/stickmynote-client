"use client"

import { useState, useCallback } from "react"
import type { AdvancedSearchParams, SearchFilters, SavedSearch } from "@/types/search"
import type { Note } from "@/types/note"

export function useAdvancedSearch() {
  const [results, setResults] = useState<Note[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const search = useCallback(async (params: AdvancedSearchParams) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/search/advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()
      setResults(data.notes)
      setTotalCount(data.totalCount)
      setHasMore(data.hasMore)
      setCurrentPage(params.page || 1)
    } catch (err) {
      console.error("Search error:", err)
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(
    async (params: AdvancedSearchParams) => {
      const nextPage = currentPage + 1
      await search({ ...params, page: nextPage })
    },
    [currentPage, search],
  )

  return {
    results,
    totalCount,
    loading,
    error,
    hasMore,
    currentPage,
    search,
    loadMore,
  }
}

export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSavedSearches = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/saved-searches")

      if (!response.ok) {
        throw new Error("Failed to fetch saved searches")
      }

      const data = await response.json()
      setSavedSearches(data.savedSearches)
    } catch (err) {
      console.error("Error fetching saved searches:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch saved searches")
    } finally {
      setLoading(false)
    }
  }, [])

  const saveSearch = useCallback(async (name: string, query: string, filters: SearchFilters) => {
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, query, filters }),
      })

      if (!response.ok) {
        throw new Error("Failed to save search")
      }

      const data = await response.json()
      setSavedSearches((prev) => [data.savedSearch, ...prev])
      return data.savedSearch
    } catch (err) {
      console.error("Error saving search:", err)
      throw err
    }
  }, [])

  const deleteSearch = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete saved search")
      }

      setSavedSearches((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error("Error deleting saved search:", err)
      throw err
    }
  }, [])

  return {
    savedSearches,
    loading,
    error,
    fetchSavedSearches,
    saveSearch,
    deleteSearch,
  }
}

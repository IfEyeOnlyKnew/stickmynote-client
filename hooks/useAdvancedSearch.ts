"use client"

import { useState, useEffect, useCallback } from "react"
import { useDebounce } from "./useDebounce"

interface UseAdvancedSearchOptions {
  endpoint: string
  initialQuery?: string
  debounceMs?: number
  fuzzy?: boolean
  filter?: string
}

interface SearchState<T> {
  results: T[]
  total: number
  hasMore: boolean
  loading: boolean
  error: string | null
  searchTime: number
}

export function useAdvancedSearch<T = any>(options: UseAdvancedSearchOptions) {
  const { endpoint, initialQuery = "", debounceMs = 300, fuzzy = true, filter = "all" } = options

  const [query, setQuery] = useState(initialQuery)
  const [state, setState] = useState<SearchState<T>>({
    results: [],
    total: 0,
    hasMore: false,
    loading: false,
    error: null,
    searchTime: 0,
  })

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceMs)

  const performSearch = useCallback(
    async (searchQuery: string, offset = 0) => {
      if (!searchQuery.trim() && offset === 0) {
        setState({
          results: [],
          total: 0,
          hasMore: false,
          loading: false,
          error: null,
          searchTime: 0,
        })
        return
      }

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const params = new URLSearchParams({
          query: searchQuery,
          offset: offset.toString(),
          limit: "20",
          fuzzy: fuzzy.toString(),
          filter,
        })

        const response = await fetch(`${endpoint}?${params}`)

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`)
        }

        const data = await response.json()

        setState({
          results: offset === 0 ? data.results : [...state.results, ...data.results],
          total: data.total,
          hasMore: data.hasMore,
          loading: false,
          error: null,
          searchTime: data.searchTime,
        })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Search failed",
        }))
      }
    },
    [endpoint, fuzzy, filter, state.results],
  )

  // Trigger search when debounced query changes
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    performSearch(debouncedQuery, 0)
  }, [debouncedQuery, filter])
  /* eslint-enable react-hooks/exhaustive-deps */

  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      performSearch(debouncedQuery, state.results.length)
    }
  }, [debouncedQuery, state.loading, state.hasMore, state.results.length, performSearch])

  const reset = useCallback(() => {
    setQuery("")
    setState({
      results: [],
      total: 0,
      hasMore: false,
      loading: false,
      error: null,
      searchTime: 0,
    })
  }, [])

  return {
    query,
    setQuery,
    ...state,
    loadMore,
    reset,
  }
}

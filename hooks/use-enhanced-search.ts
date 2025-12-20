"use client"

import { useState, useEffect, useMemo } from "react"
import { FuzzySearch } from "@/lib/search/fuzzy-search"
import { SearchFilterManager, type SavedSearchFilter } from "@/lib/search/search-filters"

interface SearchableItem {
  id: string
  topic: string
  content: string
  [key: string]: any
}

export function useEnhancedSearch<T extends SearchableItem>(
  items: T[],
  searchFields: (keyof T)[] = ["topic", "content"],
) {
  const [query, setQuery] = useState("")
  const [savedFilters, setSavedFilters] = useState<SavedSearchFilter[]>([])
  const [activeFilter, setActiveFilter] = useState<SavedSearchFilter | null>(null)
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  const filterManager = useMemo(() => new SearchFilterManager(), [])
  const fuzzySearch = useMemo(() => new FuzzySearch(items, searchFields), [items, searchFields])

  // Update search index when items change
  useEffect(() => {
    fuzzySearch.updateItems(items)
  }, [items, fuzzySearch])

  // Load saved filters
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadSavedFilters()
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem("search-history")
    if (history) {
      setSearchHistory(JSON.parse(history))
    }
  }, [])

  const loadSavedFilters = async () => {
    const filters = await filterManager.getSavedFilters()
    setSavedFilters(filters)
  }

  const saveFilter = async (name: string, filters: SavedSearchFilter["filters"]) => {
    const saved = await filterManager.saveFilter(name, filters)
    if (saved) {
      setSavedFilters((prev) => [saved, ...prev])
    }
    return saved
  }

  const deleteFilter = async (filterId: string) => {
    const success = await filterManager.deleteFilter(filterId)
    if (success) {
      setSavedFilters((prev) => prev.filter((f) => f.id !== filterId))
    }
    return success
  }

  const applyFilter = (filter: SavedSearchFilter) => {
    setActiveFilter(filter)
    if (filter.filters.query) {
      setQuery(filter.filters.query)
    }
  }

  const clearFilter = () => {
    setActiveFilter(null)
    setQuery("")
  }

  const addToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return

    const newHistory = [searchQuery, ...searchHistory.filter((q) => q !== searchQuery)].slice(0, 10)
    setSearchHistory(newHistory)
    localStorage.setItem("search-history", JSON.stringify(newHistory))
  }

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem("search-history")
  }

  // Perform fuzzy search
  /* eslint-disable react-hooks/exhaustive-deps */
  const results = useMemo(() => {
    if (!query.trim()) {
      return items.map((item) => ({ item, score: 1, matches: [] }))
    }

    addToHistory(query)
    return fuzzySearch.search(query, { threshold: 0.3, limit: 50 })
  }, [query, items, fuzzySearch])
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    query,
    setQuery,
    results,
    savedFilters,
    activeFilter,
    searchHistory,
    saveFilter,
    deleteFilter,
    applyFilter,
    clearFilter,
    clearHistory,
    refreshFilters: loadSavedFilters,
  }
}

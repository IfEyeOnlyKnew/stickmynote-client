"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Search, X, Clock, TrendingUp, Hash, User, Command } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface SearchSuggestion {
  type: "recent" | "trending" | "author" | "tag"
  value: string
  label: string
  metadata?: string
}

interface EnhancedSearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: (term: string) => void
  placeholder?: string
  recentSearches?: string[]
  trendingTags?: string[]
}

export function EnhancedSearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Search shared topics, tags, or authors…",
  recentSearches = [],
  trendingTags = [],
}: EnhancedSearchInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Build suggestions list based on input - memoized to avoid dependency issues
  const suggestions = useMemo(() => {
    const result: SearchSuggestion[] = []

    if (!value.trim()) {
      // Show recent searches when input is empty
      recentSearches.slice(0, 3).forEach((search) => {
        result.push({
          type: "recent",
          value: search,
          label: search,
        })
      })

      // Show trending tags
      trendingTags.slice(0, 5).forEach((tag) => {
        result.push({
          type: "trending",
          value: tag,
          label: tag,
          metadata: "Trending",
        })
      })
    } else {
      // Show autocomplete suggestions based on input
      const lowerValue = value.toLowerCase()

      // Filter trending tags that match
      trendingTags
        .filter((tag) => tag.toLowerCase().includes(lowerValue))
        .slice(0, 3)
        .forEach((tag) => {
          result.push({
            type: "tag",
            value: tag,
            label: tag,
          })
        })
    }

    return result
  }, [value, recentSearches, trendingTags])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // "/" to focus search
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
        setShowSuggestions(true)
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [])

  // Handle arrow keys and enter in suggestions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
          break
        case "Enter":
          e.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            const selected = suggestions[selectedIndex]
            onChange(selected.value)
            onSearch(selected.value)
            setShowSuggestions(false)
            setSelectedIndex(-1)
          } else {
            onSearch(value)
            setShowSuggestions(false)
          }
          break
        case "Escape":
          setShowSuggestions(false)
          setSelectedIndex(-1)
          break
      }
    },
    [showSuggestions, suggestions, selectedIndex, onChange, onSearch, value],
  )

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onChange(suggestion.value)
    onSearch(suggestion.value)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  // Handle clear
  const handleClear = () => {
    onChange("")
    onSearch("")
    inputRef.current?.focus()
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "recent":
        return <Clock className="h-4 w-4 text-gray-400" />
      case "trending":
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      case "tag":
        return <Hash className="h-4 w-4 text-blue-500" />
      case "author":
        return <User className="h-4 w-4 text-purple-500" />
      default:
        return <Search className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400 transition-colors pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          className="pl-12 pr-24 h-12 w-full rounded-full border-2 border-indigo-100 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all duration-300 bg-white text-gray-800 placeholder:text-gray-400"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="hidden sm:flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 border-indigo-200"
          >
            <Command className="h-3 w-3" />
            <span>/</span>
          </Badge>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full mt-2 w-full bg-white rounded-2xl border-2 border-indigo-100 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="max-h-[400px] overflow-y-auto">
            {!value.trim() && recentSearches.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Searches</p>
              </div>
            )}
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.value}-${index}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 transition-colors cursor-pointer ${
                  index === selectedIndex ? "bg-indigo-50" : ""
                }`}
              >
                {getSuggestionIcon(suggestion.type)}
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">{suggestion.label}</p>
                  {suggestion.metadata && <p className="text-xs text-gray-500">{suggestion.metadata}</p>}
                </div>
                {suggestion.type === "trending" && (
                  <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                    Hot
                  </Badge>
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <span>Use ↑↓ to navigate, Enter to select</span>
            <span className="text-indigo-600 font-medium">ESC to close</span>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"

export interface SearchableUser {
  id: string | null
  username: string | null
  email: string | null
  full_name: string | null
  source?: "ldap" | "database"
  dn?: string
}

export interface UseUserSearchOptions {
  /** Emails to exclude from results (e.g. current members) */
  excludeEmails?: Set<string>
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number
}

export interface UseUserSearchReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SearchableUser[]
  selectedUsers: SearchableUser[]
  isSearching: boolean
  presence: Record<string, { isOnline: boolean }>
  /** Ref for the search input -- cast with `as React.RefObject<HTMLInputElement>` if needed for component refs */
  inputRef: React.MutableRefObject<HTMLInputElement | null>
  handleSelectUser: (user: SearchableUser) => void
  handleRemoveUser: (userEmail: string) => void
  resetSelection: () => void
  getUserDisplayName: (user: SearchableUser) => string
  getUserInitials: (user: SearchableUser) => string
}

/**
 * Shared hook for user search with presence and selection.
 * Used by ChatInviteModal, VideoInviteUserSearch, and similar components.
 */
export function useUserSearch(options: UseUserSearchOptions = {}): UseUserSearchReturn {
  const { excludeEmails, debounceMs = 300 } = options

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchableUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<SearchableUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [presence, setPresence] = useState<Record<string, { isOnline: boolean }>>({})
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track selected user emails in a ref to avoid re-triggering search useEffect
  const selectedUserEmailsRef = useRef<Set<string>>(new Set())

  // Keep ref in sync with state
  useEffect(() => {
    selectedUserEmailsRef.current = new Set(
      selectedUsers.map((u) => u.email?.toLowerCase()).filter((e): e is string => !!e)
    )
  }, [selectedUsers])

  // Get user IDs from search results for presence lookup
  const userIdsForPresence = useMemo(
    () => searchResults.map((u) => u.id).filter((id): id is string => !!id),
    [searchResults]
  )

  // Fetch presence for search results
  useEffect(() => {
    if (userIdsForPresence.length === 0) {
      setPresence({})
      return
    }

    const fetchPresence = async () => {
      try {
        const response = await fetch(`/api/user/presence?ids=${userIdsForPresence.join(",")}`)
        if (response.ok) {
          const data = await response.json()
          setPresence(data.presence || {})
        }
      } catch {
        // Silent fail - presence is not critical
      }
    }

    fetchPresence()
  }, [userIdsForPresence])

  // Search users when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `/api/user-search?query=${encodeURIComponent(searchQuery)}`
        )
        if (response.ok) {
          const users: SearchableUser[] = await response.json()
          const filtered = users.filter((u) => {
            const email = u.email?.toLowerCase()
            return email &&
              !selectedUserEmailsRef.current.has(email) &&
              !(excludeEmails?.has(email))
          })
          setSearchResults(filtered)
        }
      } catch (err) {
        console.error("Search error:", err)
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, excludeEmails, debounceMs])

  const handleSelectUser = useCallback((user: SearchableUser) => {
    setSelectedUsers((prev) => [...prev, user])
    setSearchResults((prev) => prev.filter((u) => u.email !== user.email))
    setSearchQuery("")
  }, [])

  const handleRemoveUser = useCallback((userEmail: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.email !== userEmail))
  }, [])

  const resetSelection = useCallback(() => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedUsers([])
  }, [])

  const getUserDisplayName = useCallback((user: SearchableUser) => {
    return user.full_name || user.username || user.email || "Unknown"
  }, [])

  const getUserInitials = useCallback((user: SearchableUser) => {
    const name = user.full_name || user.username || user.email || "Unknown"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedUsers,
    isSearching,
    presence,
    inputRef,
    handleSelectUser,
    handleRemoveUser,
    resetSelection,
    getUserDisplayName,
    getUserInitials,
  }
}

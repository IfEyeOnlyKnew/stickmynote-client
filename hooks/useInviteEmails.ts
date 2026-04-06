"use client"

import { useState, useEffect, useCallback } from "react"

interface User {
  id: string
  username: string | null
  email: string | null
  full_name: string | null
}

interface SavedEmail {
  id: string
  email: string
  name?: string
  source: string
}

interface UseInviteEmailsOptions {
  /** The entity ID to scope saved emails to (padId, teamId, etc.) */
  entityId: string
  /** Query parameter name for the entity ID (default: "padId") */
  entityParam?: string
  /** Whether the modal is open */
  open: boolean
}

interface UseInviteEmailsReturn {
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: User[]
  savedEmails: SavedEmail[]
  selectedEmails: string[]
  selectedUsers: User[]
  isLoading: boolean
  manualEmails: string
  setManualEmails: (e: string) => void
  filteredSavedEmails: SavedEmail[]
  totalSelected: number
  toggleEmailSelection: (email: string) => void
  toggleUserSelection: (user: User) => void
  addManualEmail: () => Promise<void>
  addTypedEmail: () => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  resetForm: () => void
  setSelectedEmails: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedUsers: React.Dispatch<React.SetStateAction<User[]>>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  loadSavedEmails: () => Promise<void>
}

/**
 * Shared hook for invite modal state: user search, email management, selection.
 * Used by PadInviteModal and EnhancedInviteModal.
 */
export function useInviteEmails({
  entityId,
  entityParam = "padId",
  open,
}: UseInviteEmailsOptions): UseInviteEmailsReturn {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [manualEmails, setManualEmails] = useState("")

  const loadSavedEmails = useCallback(async () => {
    try {
      const response = await fetch(`/api/saved-emails?${entityParam}=${entityId}`)
      if (response.ok) {
        const data = await response.json()
        setSavedEmails(data.savedEmails || [])
      }
    } catch (err) {
      console.error("Error loading saved emails:", err)
    }
  }, [entityId, entityParam])

  useEffect(() => {
    if (open) {
      loadSavedEmails()
    }
  }, [open, loadSavedEmails])

  // Search users when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const searchUsers = async () => {
      try {
        const userResponse = await fetch(
          `/api/user-search?query=${encodeURIComponent(searchQuery)}&${entityParam}=${entityId}`
        )
        if (userResponse.ok) {
          const users = await userResponse.json()
          setSearchResults(users)
        }
      } catch (err) {
        console.error("Search error:", err)
      }
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, entityId, entityParam])

  const toggleEmailSelection = useCallback((email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }, [])

  const toggleUserSelection = useCallback((user: User) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    )
  }, [])

  const addManualEmail = useCallback(async () => {
    if (!manualEmails.trim()) return

    const emails = manualEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .map((email) => ({ email }))

    if (emails.length === 0) {
      alert("No valid emails found. Please check the format.")
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch("/api/saved-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          [entityParam]: entityId,
          source: "manual",
        }),
      })

      if (response.ok) {
        await loadSavedEmails()
        setManualEmails("")
      } else {
        const errorText = await response.text()
        alert(`Failed to save emails: ${errorText}`)
      }
    } catch (err) {
      alert(`Error adding emails: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }, [manualEmails, entityId, entityParam, loadSavedEmails])

  const addTypedEmail = useCallback(() => {
    if (searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery)) {
      const isAlreadySelected =
        selectedEmails.includes(searchQuery) || selectedUsers.some((u) => u.email === searchQuery)
      if (!isAlreadySelected) {
        setSelectedEmails((prev) => [...prev, searchQuery])
        setSearchQuery("")
      }
    }
  }, [searchQuery, selectedEmails, selectedUsers])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        addTypedEmail()
      }
    },
    [addTypedEmail]
  )

  const resetForm = useCallback(() => {
    setSearchQuery("")
    setSelectedEmails([])
    setSelectedUsers([])
    setSearchResults([])
  }, [])

  const filteredSavedEmails = savedEmails.filter((email) =>
    searchQuery
      ? email.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.name?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  const totalSelected =
    selectedUsers.length +
    selectedEmails.length +
    (searchQuery &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery) &&
    !selectedEmails.includes(searchQuery) &&
    !selectedUsers.some((u) => u.email === searchQuery)
      ? 1
      : 0)

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    savedEmails,
    selectedEmails,
    selectedUsers,
    isLoading,
    manualEmails,
    setManualEmails,
    filteredSavedEmails,
    totalSelected,
    toggleEmailSelection,
    toggleUserSelection,
    addManualEmail,
    addTypedEmail,
    handleKeyDown,
    resetForm,
    setSelectedEmails,
    setSelectedUsers,
    setIsLoading,
    loadSavedEmails,
  }
}

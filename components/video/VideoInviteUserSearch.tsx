"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, UserPlus, X, Circle } from "lucide-react"

interface User {
  id: string | null
  username: string | null
  email: string | null
  full_name: string | null
  source?: "ldap" | "database"
  dn?: string
}

interface VideoInviteUserSearchProps {
  selectedEmails: string[]
  onEmailsChange: (emails: string[]) => void
}

/**
 * User search component for video room invitations.
 * Searches LDAP and database users and allows selection.
 */
export const VideoInviteUserSearch: React.FC<VideoInviteUserSearchProps> = ({
  selectedEmails,
  onEmailsChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [presence, setPresence] = useState<Record<string, { isOnline: boolean }>>({})
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track selected user emails in a ref to avoid re-triggering search useEffect
  const selectedUserEmailsRef = useRef<Set<string>>(new Set())

  // Track if we're the one updating the parent to avoid sync loops
  const isUpdatingParentRef = useRef(false)

  // Keep ref in sync with state
  useEffect(() => {
    selectedUserEmailsRef.current = new Set(
      selectedUsers.map((u) => u.email?.toLowerCase()).filter((e): e is string => !!e)
    )
  }, [selectedUsers])

  // Sync FROM parent only when parent explicitly resets to empty
  // This handles the case when parent clears the selection after room creation
  useEffect(() => {
    // Skip if we're the one who triggered the parent update
    if (isUpdatingParentRef.current) {
      isUpdatingParentRef.current = false
      return
    }
    // Only reset internal state if parent explicitly clears
    if (selectedEmails.length === 0 && selectedUsers.length > 0) {
      setSelectedUsers([])
    }
  }, [selectedEmails]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent when selected users change
  useEffect(() => {
    const emails = selectedUsers
      .map((u) => u.email)
      .filter((e): e is string => !!e)
    // Mark that we're updating parent to avoid sync loop
    isUpdatingParentRef.current = true
    onEmailsChange(emails)
  }, [selectedUsers, onEmailsChange])

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
      } catch (err) {
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

    // Debounce search
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
          const users: User[] = await response.json()
          // Filter out already selected users (by email)
          const filtered = users.filter((u) => {
            const email = u.email?.toLowerCase()
            return email && !selectedUserEmailsRef.current.has(email)
          })
          setSearchResults(filtered)
        }
      } catch (err) {
        console.error("Search error:", err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const handleSelectUser = (user: User) => {
    setSelectedUsers((prev) => [...prev, user])
    setSearchResults((prev) => prev.filter((u) => u.email !== user.email))
    setSearchQuery("")
  }

  const handleRemoveUser = (userEmail: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.email !== userEmail))
  }

  const getUserDisplayName = (user: User) => {
    return user.full_name || user.username || user.email || "Unknown"
  }

  const getUserInitials = (user: User) => {
    const name = getUserDisplayName(user)
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-3">
      {/* Selected users */}
      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected Participants ({selectedUsers.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <Badge
                key={user.email || user.id}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <span>{getUserDisplayName(user)}</span>
                <button
                  type="button"
                  onClick={() => user.email && handleRemoveUser(user.email)}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  title={`Remove ${getUserDisplayName(user)}`}
                  aria-label={`Remove ${getUserDisplayName(user)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="space-y-2">
        <Label htmlFor="user-search">Search users to invite</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={inputRef}
            id="user-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, username, or email..."
            className="pl-10"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <ScrollArea className="h-48 border rounded-md">
          <div className="p-2 space-y-1">
            {searchResults.map((user) => {
              const isOnline = user.id ? presence[user.id]?.isOnline : false
              return (
                <button
                  key={user.id || user.email}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online/Offline indicator */}
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                        isOnline ? "text-green-500 fill-green-500" : "text-gray-400 fill-gray-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {getUserDisplayName(user)}
                      <span
                        className={`text-xs font-normal ${
                          isOnline ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    {user.email && (
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                  <UserPlus className="w-4 h-4 text-gray-400" />
                </button>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* No results message */}
      {searchQuery && !isSearching && searchResults.length === 0 && (
        <div className="text-center py-3 text-sm text-gray-500">
          No users found matching &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  )
}

"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, UserPlus, X, Users, Check, Circle } from "lucide-react"
import { useCSRF } from "@/hooks/useCSRF"
import type { StickChatMemberWithUser } from "@/types/stick-chat"

interface User {
  id: string | null
  username: string | null
  email: string | null
  full_name: string | null
  source?: "ldap" | "database"
  dn?: string
}

interface ChatInviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  chatName: string
  currentMembers: StickChatMemberWithUser[]
  onMembersUpdated: (members: StickChatMemberWithUser[]) => void
}

/**
 * Modal for inviting members to a chat room.
 */
export const ChatInviteModal: React.FC<ChatInviteModalProps> = ({
  open,
  onOpenChange,
  chatId,
  chatName,
  currentMembers,
  onMembersUpdated,
}) => {
  const { csrfToken } = useCSRF()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
          // Filter out current members and already selected users (by email since LDAP users may not have ID)
          const currentMemberEmails = new Set(
            currentMembers.map((m) => m.user?.email?.toLowerCase()).filter((e): e is string => !!e)
          )
          const filtered = users.filter(
            (u) => {
              const email = u.email?.toLowerCase()
              return email && 
                !currentMemberEmails.has(email) &&
                !selectedUserEmailsRef.current.has(email)
            }
          )
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
  }, [searchQuery, currentMembers])

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSelectUser = (user: User) => {
    setSelectedUsers((prev) => [...prev, user])
    setSearchResults((prev) => prev.filter((u) => u.email !== user.email))
    setSearchQuery("")
  }

  const handleRemoveUser = (userEmail: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.email !== userEmail))
  }

  const handleInvite = async () => {
    if (selectedUsers.length === 0) return

    setIsInviting(true)
    setError(null)

    try {
      // Add each user as a member
      for (const user of selectedUsers) {
        // For LDAP users without a database ID, send email and DN for auto-provisioning
        const body = user.id
          ? { user_id: user.id }
          : { email: user.email, dn: user.dn, full_name: user.full_name, username: user.username }

        const response = await fetch(`/api/stick-chats/${chatId}/members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to add member")
        }
      }

      // Fetch updated members list
      const membersResponse = await fetch(`/api/stick-chats/${chatId}/members`)
      if (membersResponse.ok) {
        const data = await membersResponse.json()
        onMembersUpdated(data.members)
      }

      handleClose()
    } catch (err) {
      console.error("Invite error:", err)
      setError(err instanceof Error ? err.message : "Failed to invite members")
    } finally {
      setIsInviting(false)
    }
  }

  const handleClose = () => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedUsers([])
    setError(null)
    onOpenChange(false)
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-500" />
            Invite Members to Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Chat name info */}
          <div className="text-sm text-gray-500">
            Adding members to: <span className="font-medium text-gray-700">{chatName}</span>
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected ({selectedUsers.length})</Label>
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
            <Label htmlFor="search">Search users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={inputRef}
                id="search"
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
                          <AvatarFallback className="text-xs bg-teal-100 text-teal-700">
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
            <div className="text-center py-4 text-sm text-gray-500">
              No users found matching &ldquo;{searchQuery}&rdquo;
            </div>
          )}

          {/* Current members */}
          {currentMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-500">
                Current members ({currentMembers.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {currentMembers.slice(0, 5).map((member) => (
                  <Badge key={member.id} variant="outline" className="text-xs">
                    {member.user?.full_name ||
                      member.user?.username ||
                      member.user?.email ||
                      "Unknown"}
                  </Badge>
                ))}
                {currentMembers.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{currentMembers.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isInviting}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={selectedUsers.length === 0 || isInviting}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isInviting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Invite {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

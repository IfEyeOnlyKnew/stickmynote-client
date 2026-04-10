"use client"

import React, { useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Search } from "lucide-react"
import { useUserSearch } from "@/hooks/useUserSearch"
import { UserSearchResults } from "@/components/shared/UserSearchResults"
import { SelectedUserBadges } from "@/components/shared/SelectedUserBadges"

interface VideoInviteUserSearchProps {
  readonly selectedEmails: string[]
  readonly onEmailsChange: (emails: string[]) => void
}

/**
 * User search component for video room invitations.
 * Searches LDAP and database users and allows selection.
 */
export const VideoInviteUserSearch: React.FC<VideoInviteUserSearchProps> = ({
  selectedEmails,
  onEmailsChange,
}) => {
  // Track if we're the one updating the parent to avoid sync loops
  const isUpdatingParentRef = useRef(false)

  const {
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
  } = useUserSearch()

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
      resetSelection()
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

  return (
    <div className="space-y-3">
      {/* Selected users */}
      <SelectedUserBadges
        selectedUsers={selectedUsers}
        getUserDisplayName={getUserDisplayName}
        onRemoveUser={handleRemoveUser}
        label="Selected Participants"
      />

      {/* Search input */}
      <div className="space-y-2">
        <Label htmlFor="user-search">Search users to invite</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
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
      <UserSearchResults
        searchResults={searchResults}
        presence={presence}
        getUserDisplayName={getUserDisplayName}
        getUserInitials={getUserInitials}
        onSelectUser={handleSelectUser}
        avatarColorClass="bg-blue-100 text-blue-700"
      />

      {/* No results message */}
      {searchQuery && !isSearching && searchResults.length === 0 && (
        <div className="text-center py-3 text-sm text-gray-500">
          No users found matching &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  )
}

"use client"

import React, { useState, useEffect, useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Users, Check } from "lucide-react"
import { useCSRF } from "@/hooks/useCSRF"
import { useUserSearch } from "@/hooks/useUserSearch"
import { UserSearchResults } from "@/components/shared/UserSearchResults"
import { SelectedUserBadges } from "@/components/shared/SelectedUserBadges"
import type { StickChatMemberWithUser } from "@/types/stick-chat"

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
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build exclude set from current members
  const excludeEmails = useMemo(
    () => new Set(
      currentMembers.map((m) => m.user?.email?.toLowerCase()).filter((e): e is string => !!e)
    ),
    [currentMembers]
  )

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
  } = useUserSearch({ excludeEmails })

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, inputRef])

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
    resetSelection()
    setError(null)
    onOpenChange(false)
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
          <SelectedUserBadges
            selectedUsers={selectedUsers}
            getUserDisplayName={getUserDisplayName}
            onRemoveUser={handleRemoveUser}
          />

          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="search">Search users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
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
          <UserSearchResults
            searchResults={searchResults}
            presence={presence}
            getUserDisplayName={getUserDisplayName}
            getUserInitials={getUserInitials}
            onSelectUser={handleSelectUser}
            avatarColorClass="bg-teal-100 text-teal-700"
          />

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

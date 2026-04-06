"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import type { SearchableUser } from "@/hooks/useUserSearch"

interface SelectedUserBadgesProps {
  selectedUsers: SearchableUser[]
  getUserDisplayName: (user: SearchableUser) => string
  onRemoveUser: (email: string) => void
  /** Label text (default: "Selected") */
  label?: string
}

/**
 * Shared component for displaying selected users as badges with remove buttons.
 * Used by ChatInviteModal and VideoInviteUserSearch.
 */
export function SelectedUserBadges({
  selectedUsers,
  getUserDisplayName,
  onRemoveUser,
  label = "Selected",
}: Readonly<SelectedUserBadgesProps>) {
  if (selectedUsers.length === 0) return null

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label} ({selectedUsers.length})</Label>
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
              onClick={() => user.email && onRemoveUser(user.email)}
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
  )
}

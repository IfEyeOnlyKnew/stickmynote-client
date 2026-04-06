"use client"

import React from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserPlus, Circle } from "lucide-react"
import type { SearchableUser } from "@/hooks/useUserSearch"

interface UserSearchResultsProps {
  searchResults: SearchableUser[]
  presence: Record<string, { isOnline: boolean }>
  getUserDisplayName: (user: SearchableUser) => string
  getUserInitials: (user: SearchableUser) => string
  onSelectUser: (user: SearchableUser) => void
  /** Tailwind color classes for avatar fallback (default: bg-teal-100 text-teal-700) */
  avatarColorClass?: string
}

/**
 * Shared search results list with presence indicators.
 * Used by ChatInviteModal and VideoInviteUserSearch.
 */
export function UserSearchResults({
  searchResults,
  presence,
  getUserDisplayName,
  getUserInitials,
  onSelectUser,
  avatarColorClass = "bg-teal-100 text-teal-700",
}: Readonly<UserSearchResultsProps>) {
  if (searchResults.length === 0) return null

  return (
    <ScrollArea className="h-48 border rounded-md">
      <div className="p-2 space-y-1">
        {searchResults.map((user) => {
          const isOnline = user.id ? presence[user.id]?.isOnline : false
          return (
            <button
              key={user.id || user.email}
              type="button"
              onClick={() => onSelectUser(user)}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left"
            >
              <div className="relative">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={`text-xs ${avatarColorClass}`}>
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
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
  )
}

"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { PresenceUser } from "@/hooks/use-presence"

interface PresenceAvatarsProps {
  users: PresenceUser[]
  maxDisplay?: number
}

export function PresenceAvatars({ users, maxDisplay = 3 }: Readonly<PresenceAvatarsProps>) {
  if (users.length === 0) return null

  const displayUsers = users.slice(0, maxDisplay)
  const remainingCount = users.length - maxDisplay

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <div className="flex -space-x-2">
          {displayUsers.map((user) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 border-2 border-white ring-2 ring-green-400">
                  <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.userName} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-xs">
                    {user.userName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{user.userName}</p>
                <p className="text-xs text-gray-500">Active now</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-700">
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{remainingCount} more active users</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

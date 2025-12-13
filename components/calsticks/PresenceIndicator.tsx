"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PresenceIndicatorProps {
  activeUsers: Map<string, { userId: string; username: string; taskId?: string }>
  currentTaskId?: string
  currentUserId: string
}

export function PresenceIndicator({ activeUsers, currentTaskId, currentUserId }: PresenceIndicatorProps) {
  const usersOnThisTask = Array.from(activeUsers.values()).filter(
    (user) => currentTaskId && user.taskId === currentTaskId && user.userId !== currentUserId,
  )

  if (usersOnThisTask.length === 0) return null

  return (
    <div className="flex -space-x-2">
      {usersOnThisTask.slice(0, 3).map((user) => (
        <TooltipProvider key={user.userId}>
          <Tooltip>
            <TooltipTrigger>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{user.username} is viewing</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {usersOnThisTask.length > 3 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">
          +{usersOnThisTask.length - 3}
        </div>
      )}
    </div>
  )
}

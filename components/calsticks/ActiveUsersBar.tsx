"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users } from "lucide-react"

interface ActiveUsersBarProps {
  readonly activeUsers: Map<string, { userId: string; username: string; taskId?: string }>
  readonly currentUserId: string
}

export function ActiveUsersBar({ activeUsers, currentUserId }: Readonly<ActiveUsersBarProps>) {
  const otherUsers = Array.from(activeUsers.values()).filter((user) => user.userId !== currentUserId)

  if (otherUsers.length === 0) return null

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">Active now:</span>
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 5).map((user) => (
          <Avatar key={user.userId} className="h-6 w-6 border-2 border-background">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {otherUsers.length > 5 && <span className="text-xs text-muted-foreground">+{otherUsers.length - 5} more</span>}
    </div>
  )
}

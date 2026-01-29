"use client"

import { useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useUserPresence } from "@/hooks/usePresence"
import { Eye } from "lucide-react"

interface PadMember {
  user_id: string
  role?: string
  user?: {
    id: string
    full_name: string | null
    email: string
    avatar_url?: string | null
  }
}

interface PadPresenceIndicatorProps {
  members: PadMember[]
  currentUserId?: string
  maxDisplay?: number
}

export function PadPresenceIndicator({
  members,
  currentUserId,
  maxDisplay = 5,
}: PadPresenceIndicatorProps) {
  // Get member IDs for presence tracking
  const memberIds = useMemo(() => {
    return members.map((m) => m.user_id)
  }, [members])

  // Track presence for all members
  const { presence, loading } = useUserPresence(memberIds)

  // Get online members
  const onlineMembers = useMemo(() => {
    return members.filter((m) => presence[m.user_id]?.isOnline)
  }, [members, presence])

  const getDisplayName = (member: PadMember) => {
    if (member.user?.full_name) return member.user.full_name
    if (member.user?.email) return member.user.email.split("@")[0]
    return "User"
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  if (loading || onlineMembers.length === 0) {
    return null
  }

  const displayMembers = onlineMembers.slice(0, maxDisplay)
  const remainingCount = onlineMembers.length - maxDisplay

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 border-0 flex items-center gap-1"
        >
          <Eye className="h-3 w-3" />
          <span>{onlineMembers.length} viewing</span>
        </Badge>

        <div className="flex -space-x-2">
          {displayMembers.map((member) => {
            const name = getDisplayName(member)
            const isCurrentUser = member.user_id === currentUserId

            return (
              <Tooltip key={member.user_id}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Avatar className="w-7 h-7 border-2 border-white shadow-sm">
                      {member.user?.avatar_url && (
                        <AvatarImage src={member.user.avatar_url} alt={name} />
                      )}
                      <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator dot */}
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-sm">
                    {name}
                    {isCurrentUser && " (you)"}
                  </p>
                  <p className="text-xs text-green-600">Online now</p>
                </TooltipContent>
              </Tooltip>
            )
          })}

          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center shadow-sm">
                  <span className="text-xs font-medium text-gray-600">
                    +{remainingCount}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm">
                  {remainingCount} more {remainingCount === 1 ? "person" : "people"} viewing
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

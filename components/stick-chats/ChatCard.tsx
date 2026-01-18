"use client"

import React, { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MessageSquare,
  Clock,
  Users,
  User,
  MoreVertical,
  FileText,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { StickChatWithDetails } from "@/types/stick-chat"
import { getChatDisplayName, isChatExpiringSoon, getDaysUntilExpiry } from "@/types/stick-chat"

interface ChatCardProps {
  chat: StickChatWithDetails
  currentUserId?: string
  onDelete?: (chatId: string) => void
  onExport?: (chatId: string) => void
}

export const ChatCard: React.FC<ChatCardProps> = ({
  chat,
  currentUserId,
  onDelete,
  onExport,
}) => {
  const router = useRouter()

  // Format the timestamp
  const timeAgo = useMemo(() => {
    try {
      const date = new Date(chat.updated_at)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return ""
    }
  }, [chat.updated_at])

  // Get display name for the chat
  const displayName = useMemo(() => {
    return getChatDisplayName(chat, currentUserId)
  }, [chat, currentUserId])

  // Get last message preview
  const lastMessagePreview = useMemo(() => {
    if (!chat.last_message?.content) return null
    const content = chat.last_message.content
    return content.length > 80 ? content.substring(0, 80) + "..." : content
  }, [chat.last_message])

  // Check if expiring soon
  const expiringSoon = isChatExpiringSoon(chat)
  const daysUntilExpiry = getDaysUntilExpiry(chat)

  // Get member avatars (up to 3)
  const memberAvatars = useMemo(() => {
    if (!chat.members) return []
    return chat.members.slice(0, 3)
  }, [chat.members])

  const remainingMembers = (chat.members?.length || 0) - memberAvatars.length

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase()
  }

  const handleClick = () => {
    router.push(`/chats/${chat.id}`)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(chat.id)
    }
  }

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onExport) {
      onExport(chat.id)
    }
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <Card
      className={`
        relative cursor-pointer transition-all duration-200
        hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1
        overflow-hidden bg-white
        ${expiringSoon ? "border-orange-300" : "border-gray-200"}
      `}
      style={{
        borderWidth: expiringSoon ? "2px" : "1px",
        borderStyle: "solid",
      }}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        {/* Header: Title + Actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {chat.is_group ? (
              <Users className="w-5 h-5 text-purple-500 flex-shrink-0" />
            ) : (
              <User className="w-5 h-5 text-blue-500 flex-shrink-0" />
            )}
            <h3 className="font-semibold text-base leading-tight line-clamp-1 text-gray-900">
              {displayName}
            </h3>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Unread badge */}
            {chat.unread_count && chat.unread_count > 0 && (
              <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                {chat.unread_count > 99 ? "99+" : chat.unread_count}
              </Badge>
            )}

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleMenuClick}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export to DOCX
                </DropdownMenuItem>
                {chat.owner_id === currentUserId && (
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Chat
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stick context badge if attached to a stick */}
        {chat.stick_topic && (
          <Badge variant="secondary" className="text-xs mb-2 bg-purple-50 text-purple-700">
            <MessageSquare className="w-3 h-3 mr-1" />
            {chat.stick_topic.length > 30
              ? chat.stick_topic.substring(0, 30) + "..."
              : chat.stick_topic}
          </Badge>
        )}

        {/* Last message preview */}
        {lastMessagePreview ? (
          <p className="text-sm leading-relaxed line-clamp-2 mb-3 text-gray-500">
            {lastMessagePreview}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic mb-3">No messages yet</p>
        )}

        {/* Member avatars for group chats */}
        {chat.is_group && memberAvatars.length > 0 && (
          <div className="flex items-center gap-1 mb-3">
            <div className="flex -space-x-2">
              {memberAvatars.map((member) => (
                <Avatar key={member.id} className="h-6 w-6 border-2 border-white">
                  <AvatarFallback className="text-xs bg-gray-200">
                    {getInitials(
                      member.user?.full_name ||
                        member.user?.username ||
                        member.user?.email ||
                        "U"
                    )}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {remainingMembers > 0 && (
              <span className="text-xs text-gray-500">+{remainingMembers}</span>
            )}
          </div>
        )}

        {/* Footer: Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {/* Time */}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
          </div>

          {/* Expiry warning */}
          {expiringSoon && (
            <span className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="w-3 h-3" />
              {daysUntilExpiry}d left
            </span>
          )}

          {/* Group/DM indicator */}
          {!expiringSoon && (
            <span className="text-gray-400">
              {chat.is_group ? "Group" : "DM"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useNotifications } from "@/hooks/use-notifications"
import { Button } from "@/components/ui/button"
import { Trash2, MessageSquare, Users, Tag, AtSign } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { NotificationWithUser } from "@/types/notifications"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface NotificationItemProps {
  notification: NotificationWithUser
}

export function NotificationItem({ notification }: Readonly<NotificationItemProps>) {
  const { markAsRead, deleteNotification } = useNotifications()
  const router = useRouter()

  const handleClick = async () => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    if (notification.action_url) {
      router.push(notification.action_url)
    }
  }

  const getIcon = () => {
    switch (notification.type) {
      case "reply":
        return <MessageSquare className="h-4 w-4" />
      case "pad_invite":
        return <Users className="h-4 w-4" />
      case "tag":
        return <Tag className="h-4 w-4" />
      case "mention":
        return <AtSign className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  return (
    <div
      tabIndex={0}
      className={cn(
        "flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer group",
        !notification.read && "bg-blue-50/50 dark:bg-blue-950/20",
      )}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div
        className={cn(
          "p-2 rounded-full",
          notification.read ? "bg-muted text-muted-foreground" : "bg-blue-100 text-blue-600",
        )}
      >
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-tight">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
          </div>
          {!notification.read && <div className="w-2 h-2 bg-blue-600 rounded-full mt-1 flex-shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          deleteNotification(notification.id)
        }}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete notification</span>
      </Button>
    </div>
  )
}

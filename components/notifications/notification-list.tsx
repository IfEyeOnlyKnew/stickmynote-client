"use client"

import { useNotifications } from "@/hooks/use-notifications"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, CheckCheck, Bell } from "lucide-react"
import { NotificationItem } from "./notification-item"

export function NotificationList() {
  const { notifications, unreadCount, loading, markAllAsRead } = useNotifications()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Bell className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-muted-foreground">No notifications</p>
        <p className="text-xs text-muted-foreground mt-1">You are all caught up</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Notifications</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs">
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>
      <ScrollArea className="max-h-[400px]">
        <div className="divide-y">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

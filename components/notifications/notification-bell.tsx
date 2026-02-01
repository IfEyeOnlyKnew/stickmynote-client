"use client"

import { useState } from "react"
import { Bell, BellOff, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NotificationList } from "./notification-list"
import { ChatRequestList } from "./chat-request-list"
import { useNotifications } from "@/hooks/use-notifications"
import { useChatRequests } from "@/hooks/useChatRequests"
import { useUserStatus } from "@/hooks/useUserStatus"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function NotificationBell() {
  const { unreadCount } = useNotifications()
  const { pendingCount } = useChatRequests()
  const { effective } = useUserStatus()
  const [activeTab, setActiveTab] = useState("notifications")

  const totalCount = unreadCount + pendingCount
  const focusModeEnabled = effective?.focus_mode_enabled ?? false

  // When focus mode is on, show muted bell and hide badge
  if (focusModeEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                  <BellOff className="h-5 w-5" />
                  <span className="sr-only">Notifications (Focus Mode)</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                {/* Focus mode banner */}
                <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-4 py-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <BellOff className="h-4 w-4" />
                    <span className="text-sm font-medium">Focus Mode is on</span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                    Notification badges are hidden. You have {totalCount} notification{totalCount !== 1 ? "s" : ""}.
                  </p>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
                    <TabsTrigger value="notifications" className="relative data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-1 text-xs bg-gray-400 text-white rounded-full px-1.5">
                          {unreadCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="chat-requests" className="relative data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Chats
                      {pendingCount > 0 && (
                        <span className="ml-1 text-xs bg-gray-400 text-white rounded-full px-1.5">
                          {pendingCount}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="notifications" className="m-0">
                    <NotificationList />
                  </TabsContent>
                  <TabsContent value="chat-requests" className="m-0">
                    <ChatRequestList />
                  </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>
          </TooltipTrigger>
          <TooltipContent>
            <p>Focus Mode is on - notifications muted</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="notifications" className="relative data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1 text-xs bg-red-500 text-white rounded-full px-1.5">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="chat-requests" className="relative data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <MessageCircle className="h-4 w-4 mr-1" />
              Chats
              {pendingCount > 0 && (
                <span className="ml-1 text-xs bg-purple-500 text-white rounded-full px-1.5">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notifications" className="m-0">
            <NotificationList />
          </TabsContent>
          <TabsContent value="chat-requests" className="m-0">
            <ChatRequestList />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

"use client"
import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useInferenceNotifications } from "@/hooks/use-inference-notifications"
import {
  Bell,
  CheckCheck,
  Trash2,
  MessageSquare,
  Users,
  Edit,
  Heart,
  Settings,
  ChevronDown,
  ChevronRight,
  BellOff,
  MoreHorizontal,
  Inbox,
  Activity,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { NotificationPreferencesModal } from "@/components/inference/notification-preferences-modal"
import { StickDetailModal } from "@/components/inference/stick-detail-modal"

interface NotificationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface GroupedNotification {
  key: string
  padId: string
  padName: string
  stickId?: string
  stickTopic?: string
  notifications: any[]
  latestAt: Date
  unreadCount: number
  activityTypes: Set<string>
}

export function NotificationsModal({ open, onOpenChange }: Readonly<NotificationsModalProps>) {
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useInferenceNotifications()
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedStickId, setSelectedStickId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [mutedItems, setMutedItems] = useState<Set<string>>(new Set())

  const { actionableGroups, activityGroups, unreadCount } = useMemo(() => {
    const groups = new Map<string, GroupedNotification>()
    let unread = 0

    notifications.forEach((n: any) => {
      if (!n.metadata?.read) unread++

      const padId = n.metadata?.pad_id || "unknown"
      const padName = n.metadata?.pad_name || "Unknown Pad"
      const stickId = n.note_id || null
      const stickTopic = n.metadata?.stick_topic || null

      // Group key: pad + stick (if exists)
      const key = stickId ? `${padId}:${stickId}` : `${padId}:pad-level`

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          padId,
          padName,
          stickId,
          stickTopic,
          notifications: [],
          latestAt: new Date(n.created_at),
          unreadCount: 0,
          activityTypes: new Set(),
        })
      }

      const group = groups.get(key)!
      group.notifications.push(n)
      group.activityTypes.add(n.activity_type)
      if (!n.metadata?.read) group.unreadCount++
      const notifDate = new Date(n.created_at)
      if (notifDate > group.latestAt) group.latestAt = notifDate
    })

    // Sort by latest activity
    const sorted = Array.from(groups.values()).sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())

    // Split into actionable (unread, mentions, replies to your sticks) vs activity (noise)
    const actionable: GroupedNotification[] = []
    const activity: GroupedNotification[] = []

    sorted.forEach((group) => {
      // Check if muted
      if (mutedItems.has(group.key)) {
        activity.push(group)
        return
      }

      // Actionable: has unread OR is a direct reply/mention
      const hasActionable =
        group.unreadCount > 0 ||
        group.activityTypes.has("stick_replied") ||
        group.activityTypes.has("note_replied") ||
        group.activityTypes.has("member_added") ||
        group.activityTypes.has("pad_member_added")

      if (hasActionable) {
        actionable.push(group)
      } else {
        activity.push(group)
      }
    })

    return { actionableGroups: actionable, activityGroups: activity, unreadCount: unread }
  }, [notifications, mutedItems])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleMuteItem = (key: string) => {
    setMutedItems((prev) => new Set(prev).add(key))
  }

  const handleUnmuteItem = (key: string) => {
    setMutedItems((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const handleMarkGroupRead = (group: GroupedNotification) => {
    group.notifications.forEach((n) => {
      if (!n.metadata?.read) markAsRead(n.id)
    })
  }

  const handleDeleteGroup = (group: GroupedNotification) => {
    group.notifications.forEach((n) => deleteNotification(n.id))
  }

  const getActivityIcon = (activityTypes: Set<string>) => {
    if (activityTypes.has("stick_replied") || activityTypes.has("note_replied")) {
      return <MessageSquare className="h-5 w-5 text-green-600" />
    }
    if (activityTypes.has("member_added") || activityTypes.has("pad_member_added")) {
      return <Users className="h-5 w-5 text-purple-600" />
    }
    if (activityTypes.has("reaction_added")) {
      return <Heart className="h-5 w-5 text-pink-600" />
    }
    if (activityTypes.has("stick_created") || activityTypes.has("note_created")) {
      return <Edit className="h-5 w-5 text-blue-600" />
    }
    return <Bell className="h-5 w-5 text-gray-600" />
  }

  const getGroupSummary = (group: GroupedNotification) => {
    const count = group.notifications.length
    const types = group.activityTypes

    if (count === 1) {
      const n = group.notifications[0]
      const userName = n.users?.full_name || n.users?.email?.split("@")[0] || "Someone"
      if (types.has("stick_replied") || types.has("note_replied")) {
        return `${userName} replied`
      }
      if (types.has("stick_created") || types.has("note_created")) {
        return `${userName} created a stick`
      }
      if (types.has("member_added") || types.has("pad_member_added")) {
        return `${userName} added you`
      }
      return `${userName} performed an action`
    }

    // Multiple notifications - summarize
    const replyCount = group.notifications.filter(
      (n) => n.activity_type === "stick_replied" || n.activity_type === "note_replied",
    ).length

    if (replyCount > 0) {
      return `${replyCount} new ${replyCount === 1 ? "reply" : "replies"}`
    }

    return `${count} updates`
  }

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id)
    if (notification.note_id) {
      setSelectedStickId(notification.note_id)
    }
  }

  const renderGroup = (group: GroupedNotification, showMuteOption = true) => {
    const isExpanded = expandedGroups.has(group.key)
    const isMuted = mutedItems.has(group.key)
    const summary = getGroupSummary(group)

    return (
      <Card
        key={group.key}
        className={`transition-all ${
          group.unreadCount > 0 ? "bg-blue-50/50 border-blue-200" : "bg-white"
        } ${isMuted ? "opacity-60" : ""}`}
      >
        <CardContent className="p-0">
          {/* Group header */}
          <button
            type="button"
            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 bg-transparent border-none text-left w-full"
            onClick={() => group.notifications.length > 1 && toggleGroup(group.key)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); group.notifications.length > 1 && toggleGroup(group.key) } }}
          >
            <div className="shrink-0">{getActivityIcon(group.activityTypes)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{group.stickTopic || group.padName}</h3>
                {group.unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                    {group.unreadCount} new
                  </Badge>
                )}
                {isMuted && (
                  <Badge variant="outline" className="text-xs">
                    <BellOff className="h-3 w-3 mr-1" />
                    Muted
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">{summary}</p>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(group.latestAt, { addSuffix: true })}
                {group.stickTopic && ` · ${group.padName}`}
              </span>
            </div>

            {/* Expand indicator for multiple notifications */}
            {group.notifications.length > 1 && (
              <div className="shrink-0 text-gray-400">
                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            )}

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {group.unreadCount > 0 && (
                  <DropdownMenuItem onClick={() => handleMarkGroupRead(group)}>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark as read
                  </DropdownMenuItem>
                )}
                {group.stickId && (
                  <DropdownMenuItem onClick={() => setSelectedStickId(group.stickId!)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View stick
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {showMuteOption &&
                  (isMuted ? (
                    <DropdownMenuItem onClick={() => handleUnmuteItem(group.key)}>
                      <Bell className="h-4 w-4 mr-2" />
                      Unmute
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleMuteItem(group.key)}>
                      <BellOff className="h-4 w-4 mr-2" />
                      Mute
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuItem onClick={() => handleDeleteGroup(group)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </button>

          {/* Expanded individual notifications */}
          {isExpanded && group.notifications.length > 1 && (
            <div className="border-t bg-gray-50/50">
              {group.notifications.map((notification: any) => {
                const userName = notification.users?.full_name || notification.users?.email?.split("@")[0] || "Someone"
                const isRead = notification.metadata?.read

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-100 w-full text-left ${
                      isRead ? "" : "bg-blue-50/30"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="w-5" /> {/* Spacer for alignment */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{userName}</span>{" "}
                        {notification.activity_type.includes("replied") ? "replied" : "updated"}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {!isRead && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">Notifications</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up!"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPreferences(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="inbox" className="w-full">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="inbox" className="flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Inbox
                  {actionableGroups.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {actionableGroups.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity
                  {activityGroups.length > 0 && (
                    <Badge variant="outline" className="ml-1">
                      {activityGroups.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="inbox" className="mt-0">
              <ScrollArea className="h-[calc(80vh-200px)] px-6">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                  </div>
                )}
                {!loading && actionableGroups.length === 0 && (
                  <div className="text-center py-12">
                    <Inbox className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Inbox Zero</h3>
                    <p className="text-gray-600">No actionable notifications right now.</p>
                  </div>
                )}
                {!loading && actionableGroups.length > 0 && (
                  <div className="space-y-2 py-4">{actionableGroups.map((group) => renderGroup(group))}</div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ScrollArea className="h-[calc(80vh-200px)] px-6">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                  </div>
                )}
                {!loading && activityGroups.length === 0 && (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Activity</h3>
                    <p className="text-gray-600">Recent activity will appear here.</p>
                  </div>
                )}
                {!loading && activityGroups.length > 0 && (
                  <div className="space-y-2 py-4">{activityGroups.map((group) => renderGroup(group, false))}</div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <NotificationPreferencesModal open={showPreferences} onOpenChange={setShowPreferences} />

      {selectedStickId && (
        <StickDetailModal
          open={!!selectedStickId}
          onOpenChange={(open) => !open && setSelectedStickId(null)}
          stickId={selectedStickId}
        />
      )}
    </>
  )
}

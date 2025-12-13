"use client"

import { useEffect } from "react"

import type React from "react"
import { useState } from "react"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useUser } from "@/contexts/user-context"
import { useSocialNotifications } from "@/hooks/use-social-notifications"
import { Bell, CheckCheck, Trash2, MessageSquare, Users, Edit, Heart, Settings } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { NotificationPreferencesModal } from "@/components/social/notification-preferences-modal"
import { StickDetailModal } from "@/components/social/stick-detail-modal"

export default function SocialNotificationsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useSocialNotifications()
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedStickId, setSelectedStickId] = useState<string | null>(null)

  useEffect(() => {
    console.log("[v0] Notifications loaded:", notifications.length)
    notifications.forEach((n: any) => {
      console.log("[v0] Notification:", n.activity_type, n.note_id, n.metadata)
    })
  }, [notifications])

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth")
    }
  }, [user, userLoading, router])

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case "note_created":
      case "stick_created":
        return <Edit className="h-5 w-5 text-blue-600" />
      case "note_replied":
      case "stick_replied":
        return <MessageSquare className="h-5 w-5 text-green-600" />
      case "pad_member_added":
      case "member_added":
        return <Users className="h-5 w-5 text-purple-600" />
      case "reaction_added":
        return <Heart className="h-5 w-5 text-pink-600" />
      default:
        return <Bell className="h-5 w-5 text-gray-600" />
    }
  }

  const getNotificationContent = (notification: any) => {
    const userName = notification.users?.full_name || notification.users?.email?.split("@")[0] || "Someone"
    const activityType = notification.activity_type
    const stickTopic = notification.metadata?.stick_topic || "Untitled Stick"
    const padName = notification.metadata?.pad_name || "Unknown Pad"

    let title = "Activity"
    let message = "You have a new activity"

    switch (activityType) {
      case "note_created":
      case "stick_created":
        title = `New Stick: ${stickTopic}`
        message = `${userName} created a new stick in ${padName}`
        break
      case "note_replied":
      case "stick_replied":
        title = `Reply on: ${stickTopic}`
        message = `${userName} replied in ${padName}`
        break
      case "pad_member_added":
      case "member_added":
        title = "Added to Pad"
        message = `${userName} added you to ${padName}`
        break
      case "note_updated":
      case "stick_updated":
        title = `Stick Updated: ${stickTopic}`
        message = `${userName} updated a stick in ${padName}`
        break
      case "reaction_added":
        title = "New Reaction"
        message = `${userName} reacted to your content in ${padName}`
        break
      default:
        title = "Activity"
        message = `${userName} performed an action in ${padName}`
    }

    return { title, message }
  }

  const handleNotificationClick = (notification: any) => {
    console.log("[v0] Notification clicked:", notification.id, notification.note_id)
    markAsRead(notification.id)

    if (notification.note_id) {
      setSelectedStickId(notification.note_id)
    }
  }

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    console.log("[v0] Deleting notification:", notificationId)
    deleteNotification(notificationId)
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!user) return null

  const unreadCount = notifications.filter((n: any) => !n.metadata?.read).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Social", href: "/social" },
            { label: "Notifications", current: true },
          ]}
        />

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Social Notifications</h1>
            <p className="text-gray-600">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up!"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreferences(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Preferences
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
              <p className="text-gray-600 mb-4">You're all caught up!</p>
              <Button onClick={() => router.push("/social")}>Go to Social Hub</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification: any) => {
              const { title, message } = getNotificationContent(notification)
              const isRead = notification.metadata?.read

              return (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isRead ? "bg-white" : "bg-blue-50 border-blue-200"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-1">{getActivityIcon(notification.activity_type)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{message}</p>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                        className="text-gray-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <NotificationPreferencesModal open={showPreferences} onOpenChange={setShowPreferences} />

        {selectedStickId && (
          <StickDetailModal
            open={!!selectedStickId}
            onOpenChange={(open) => !open && setSelectedStickId(null)}
            stickId={selectedStickId}
            onUpdate={() => {
              // Optionally refresh notifications after stick update
            }}
          />
        )}
      </div>
    </div>
  )
}

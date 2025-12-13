"use client"

import { useState, useEffect, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { NotificationWithUser } from "@/types/notifications"

interface Activity {
  id: string
  note_id: string
  user_id: string
  action_type: string
  metadata: Record<string, unknown> | null
  created_at: string
  triggered_by_user?: {
    full_name: string
    email: string
    avatar_url?: string
  }
  notes?: {
    topic: string
  }
}

function activityToNotification(activity: Activity): NotificationWithUser {
  const actionTypeMap: Record<string, string> = {
    created: "created a note",
    updated: "updated a note",
    replied: "replied to your note",
    shared: "shared a note",
    stick_created: "created a stick",
    stick_replied: "replied to your stick",
    reaction_added: "reacted to your content",
  }

  return {
    id: activity.id,
    user_id: activity.user_id,
    type: activity.action_type === "replied" || activity.action_type === "stick_replied" ? "reply" : "pad_update",
    title: activity.triggered_by_user?.full_name || "Someone",
    message: `${actionTypeMap[activity.action_type] || activity.action_type}${
      activity.notes?.topic ? `: ${activity.notes.topic}` : ""
    }`,
    related_id: activity.note_id,
    related_type: "note",
    action_url: `/notes?note=${activity.note_id}`,
    read: (activity.metadata?.read as boolean) || false,
    created_at: activity.created_at,
    created_by: activity.user_id,
    metadata: activity.metadata || {},
    created_by_user: activity.triggered_by_user
      ? {
          full_name: activity.triggered_by_user.full_name,
          email: activity.triggered_by_user.email,
          avatar_url: activity.triggered_by_user.avatar_url || null,
        }
      : undefined,
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationWithUser[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createSupabaseBrowser()

  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    try {
      setLoading(true)
      const url = `/api/notifications?limit=50${unreadOnly ? "&unread=true" : ""}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch notifications")
      }

      const data = await response.json()
      const convertedNotifications = (data.notifications || []).map((activity: Activity) =>
        activityToNotification(activity),
      )
      setNotifications(convertedNotifications)
      setUnreadCount(convertedNotifications.filter((n: NotificationWithUser) => !n.read).length)
      setError(null)
    } catch (err) {
      console.error("Error fetching notifications:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch notifications")
    } finally {
      setLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      })

      if (!response.ok) {
        throw new Error("Failed to mark as read")
      }

      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error("Error marking notification as read:", err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to mark all as read")
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error("Error marking all as read:", err)
    }
  }, [])

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete notification")
      }

      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.id !== notificationId)
        const wasUnread = prev.find((n) => n.id === notificationId && !n.read)
        if (wasUnread) {
          setUnreadCount((count) => Math.max(0, count - 1))
        }
        return filtered
      })
    } catch (err) {
      console.error("Error deleting notification:", err)
    }
  }, [])

  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const channel: RealtimeChannel = supabase
        .channel(`activities:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "personal_sticks_activities",
          },
          (payload: RealtimePostgresChangesPayload<Activity>) => {
            const newActivity = payload.new as Activity
            const newNotification = activityToNotification(newActivity)
            setNotifications((prev) => [newNotification, ...prev])
            if (!newNotification.read) {
              setUnreadCount((prev) => prev + 1)
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "personal_sticks_activities",
          },
          (payload: RealtimePostgresChangesPayload<Activity>) => {
            const updatedActivity = payload.new as Activity
            const updatedNotification = activityToNotification(updatedActivity)
            setNotifications((prev) => prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n)))
            if (updatedNotification.read) {
              setUnreadCount((prev) => Math.max(0, prev - 1))
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "personal_sticks_activities",
          },
          (payload: RealtimePostgresChangesPayload<Activity>) => {
            const deletedActivity = payload.old as Activity
            setNotifications((prev) => prev.filter((n) => n.id !== deletedActivity.id))
            if (!(deletedActivity.metadata?.read as boolean)) {
              setUnreadCount((prev) => Math.max(0, prev - 1))
            }
          },
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    }

    fetchNotifications()
    const cleanup = setupRealtimeSubscription()

    return () => {
      cleanup.then((fn) => fn && fn())
    }
  }, [fetchNotifications, supabase])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }
}

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { NotificationWithUser } from "@/types/notifications"

// ============================================================================
// Types
// ============================================================================

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

interface NotificationState {
  notifications: NotificationWithUser[]
  unreadCount: number
  loading: boolean
  error: string | null
}

// ============================================================================
// Constants
// ============================================================================

const ACTION_TYPE_MAP: Record<string, string> = {
  created: "created a note",
  updated: "updated a note",
  replied: "replied to your note",
  shared: "shared a note",
  stick_created: "created a stick",
  stick_replied: "replied to your stick",
  reaction_added: "reacted to your content",
} as const

const REPLY_ACTION_TYPES = ["replied", "stick_replied"]

// ============================================================================
// Helpers
// ============================================================================

function activityToNotification(activity: Activity): NotificationWithUser {
  const actionLabel = ACTION_TYPE_MAP[activity.action_type] || activity.action_type
  const topicSuffix = activity.notes?.topic ? `: ${activity.notes.topic}` : ""

  return {
    id: activity.id,
    user_id: activity.user_id,
    type: REPLY_ACTION_TYPES.includes(activity.action_type) ? "reply" : "pad_update",
    title: activity.triggered_by_user?.full_name || "Someone",
    message: `${actionLabel}${topicSuffix}`,
    related_id: activity.note_id,
    related_type: "note",
    action_url: `/personal?note=${activity.note_id}`,
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

// ============================================================================
// Hook
// ============================================================================

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
    error: null,
  })

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    try {
      setState((prev) => ({ ...prev, loading: true }))
      const url = `/api/notifications?limit=50${unreadOnly ? "&unread=true" : ""}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch notifications")
      }

      const data = await response.json()
      const convertedNotifications = (data.notifications || []).map(activityToNotification)
      const unreadCount = convertedNotifications.filter((n: NotificationWithUser) => !n.read).length

      setState({
        notifications: convertedNotifications,
        unreadCount,
        loading: false,
        error: null,
      })
    } catch (err) {
      console.error("[Notifications] Error fetching:", err)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch notifications",
      }))
    }
  }, [])

  // Mark single notification as read
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

      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }))
    } catch (err) {
      console.error("[Notifications] Error marking as read:", err)
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to mark all as read")
      }

      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }))
    } catch (err) {
      console.error("[Notifications] Error marking all as read:", err)
    }
  }, [])

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete notification")
      }

      setState((prev) => {
        const notification = prev.notifications.find((n) => n.id === notificationId)
        const wasUnread = notification && !notification.read

        return {
          ...prev,
          notifications: prev.notifications.filter((n) => n.id !== notificationId),
          unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
        }
      })
    } catch (err) {
      console.error("[Notifications] Error deleting:", err)
    }
  }, [])

  // Setup polling for notifications instead of realtime subscription
  useEffect(() => {
    fetchNotifications()

    // Poll every 30 seconds for new notifications
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications()
    }, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [fetchNotifications])

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }
}

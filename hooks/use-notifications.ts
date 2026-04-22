"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWebSocket } from "@/hooks/useWebSocket"
import type { NotificationWithUser } from "@/types/notifications"

// ============================================================================
// Types
// ============================================================================

interface NotificationState {
  notifications: NotificationWithUser[]
  unreadCount: number
  loading: boolean
  error: string | null
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
      const notifications: NotificationWithUser[] = data.notifications || []
      const unreadCount = notifications.filter((n) => !n.read).length

      setState({
        notifications,
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

  // Extracted to reduce function nesting depth
  const markNotificationReadLocally = useCallback((notificationId: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }))
  }, [])

  // WebSocket subscription for real-time push
  const { connected: wsConnected, subscribe } = useWebSocket()

  const handleWsNotificationNew = useCallback(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleWsNotificationRead = useCallback((payload: { id: string }) => {
    markNotificationReadLocally(payload.id)
  }, [markNotificationReadLocally])

  useEffect(() => {
    if (!wsConnected) return

    const unsubs = [
      subscribe("notification.new", handleWsNotificationNew),
      subscribe("notification.read", handleWsNotificationRead),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [wsConnected, subscribe, handleWsNotificationNew, handleWsNotificationRead])

  // Initial fetch
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Polling fallback — only when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected) return

    pollIntervalRef.current = setInterval(() => {
      fetchNotifications()
    }, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [wsConnected, fetchNotifications])

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

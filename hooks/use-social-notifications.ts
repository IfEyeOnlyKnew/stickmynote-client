"use client"

import { useEffect, useState, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

interface SocialNotification {
  id: string
  activity_type: string
  note_id: string | null
  user_id: string
  metadata: any
  created_at: string
  users?: {
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface Subscription {
  id: string
  entity_type: string
  entity_id: string
  channel_in_app: boolean
  channel_email: boolean
  notify_replies: boolean
  notify_updates: boolean
  notify_mentions: boolean
  notify_status_changes: boolean
}

export function useSocialNotifications() {
  const [notifications, setNotifications] = useState<SocialNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const supabase = createSupabaseBrowser()

  const fetchSubscriptions = useCallback(async () => {
    try {
      const response = await fetch("/api/subscriptions")
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions || [])
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch("/api/social-notifications")
      if (response.ok) {
        const data = await response.json()
        const allNotifications = data.notifications || []

        let filteredNotifications = allNotifications
        if (subscriptions.length > 0) {
          const followedEntityIds = new Set(subscriptions.filter((s) => s.channel_in_app).map((s) => s.entity_id))

          filteredNotifications = allNotifications.filter((n: SocialNotification) => {
            if (n.activity_type === "mention") return true
            if (n.metadata?.pad_id && followedEntityIds.has(n.metadata.pad_id)) return true
            if (n.metadata?.stick_id && followedEntityIds.has(n.metadata.stick_id)) return true
            if (!n.metadata?.pad_id && !n.metadata?.stick_id) return true
            if (subscriptions.length === 0) return true
            return false
          })
        }

        setNotifications(filteredNotifications)
        setUnreadCount(filteredNotifications.filter((n: SocialNotification) => !n.metadata?.read).length)
      }
    } catch (error) {
      console.error("Error fetching social notifications:", error)
    } finally {
      setLoading(false)
    }
  }, [subscriptions])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  useEffect(() => {
    fetchNotifications()

    const channel = supabase
      .channel("social-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_sticks",
        },
        () => {
          fetchNotifications()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_stick_replies",
        },
        () => {
          fetchNotifications()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications])

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/social-notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationKey: notificationId }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, metadata: { ...n.metadata, read: true } } : n)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/social-notifications/mark-all-read", {
        method: "POST",
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, metadata: { ...n.metadata, read: true } })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      await markAsRead(notificationId)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      const wasUnread = notifications.find((n) => n.id === notificationId)?.metadata?.read === false
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Error deleting notification:", error)
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    subscriptions,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
    refreshSubscriptions: fetchSubscriptions,
  }
}

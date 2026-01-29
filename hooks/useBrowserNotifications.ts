"use client"

import { useState, useEffect, useCallback } from "react"

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  onClick?: () => void
}

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === "granted"
    } catch {
      return false
    }
  }, [isSupported])

  const showNotification = useCallback(
    (options: NotificationOptions) => {
      if (!isSupported || permission !== "granted") {
        return null
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || "/favicon.ico",
          tag: options.tag, // Prevents duplicate notifications with same tag
          requireInteraction: false,
        })

        if (options.onClick) {
          notification.onclick = () => {
            options.onClick?.()
            window.focus()
            notification.close()
          }
        }

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000)

        return notification
      } catch (error) {
        console.error("[Notifications] Error showing notification:", error)
        return null
      }
    },
    [isSupported, permission]
  )

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    isEnabled: isSupported && permission === "granted",
  }
}

// Hook for managing chat-specific notifications
export function useChatNotifications(padId: string, padName: string, isModerator: boolean) {
  const { showNotification, requestPermission, permission, isSupported } = useBrowserNotifications()
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Load notification preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`chat-notifications-${padId}`)
      setNotificationsEnabled(stored === "true")
    }
  }, [padId])

  const enableNotifications = useCallback(async () => {
    if (permission === "default") {
      const granted = await requestPermission()
      if (granted) {
        setNotificationsEnabled(true)
        localStorage.setItem(`chat-notifications-${padId}`, "true")
      }
      return granted
    } else if (permission === "granted") {
      setNotificationsEnabled(true)
      localStorage.setItem(`chat-notifications-${padId}`, "true")
      return true
    }
    return false
  }, [permission, requestPermission, padId])

  const disableNotifications = useCallback(() => {
    setNotificationsEnabled(false)
    localStorage.setItem(`chat-notifications-${padId}`, "false")
  }, [padId])

  const notifyNewMessage = useCallback(
    (senderName: string, messagePreview: string) => {
      if (!notificationsEnabled || !isModerator) return

      // Only show if window is not focused
      if (document.hasFocus()) return

      showNotification({
        title: `New message in ${padName}`,
        body: `${senderName}: ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? "..." : ""}`,
        tag: `chat-${padId}`, // Prevents multiple notifications for same chat
        onClick: () => {
          // Focus the window - the component will handle scrolling to new messages
        },
      })
    },
    [notificationsEnabled, isModerator, showNotification, padName, padId]
  )

  const notifyMention = useCallback(
    (senderName: string, messagePreview: string) => {
      if (!notificationsEnabled) return

      showNotification({
        title: `You were mentioned in ${padName}`,
        body: `${senderName}: ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? "..." : ""}`,
        tag: `mention-${padId}`,
        onClick: () => {
          // Focus the window
        },
      })
    },
    [notificationsEnabled, showNotification, padName, padId]
  )

  return {
    isSupported,
    permission,
    notificationsEnabled,
    enableNotifications,
    disableNotifications,
    notifyNewMessage,
    notifyMention,
  }
}

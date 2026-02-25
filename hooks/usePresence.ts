"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@/contexts/user-context"
import { useWebSocket } from "@/hooks/useWebSocket"

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000

/**
 * Hook to track user presence by sending periodic heartbeats.
 * Should be used once at the app level (e.g., in layout or a provider).
 */
export function usePresenceHeartbeat() {
  const { user } = useUser()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) {
      // Clear interval if user logs out
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Send initial heartbeat
    sendHeartbeat()

    // Set up periodic heartbeat
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    // Also send heartbeat on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user])
}

async function sendHeartbeat() {
  try {
    await fetch("/api/user/presence", { method: "POST" })
  } catch (err) {
    // Silent fail - presence is not critical
    console.debug("[Presence] Heartbeat failed:", err)
  }
}

/**
 * Hook to get presence status for a list of user IDs.
 * Returns a map of userId -> { isOnline, lastSeenAt }
 */
export function useUserPresence(userIds: string[]) {
  const [presence, setPresence] = useState<Record<string, { isOnline: boolean; lastSeenAt: string | null }>>({})
  const [loading, setLoading] = useState(false)
  const { connected: wsConnected, subscribe } = useWebSocket()
  const userIdsKey = userIds.join(",")

  const fetchPresence = async () => {
    if (userIds.length === 0) return
    setLoading(true)
    try {
      const response = await fetch(`/api/user/presence?ids=${userIds.join(",")}`)
      if (response.ok) {
        const data = await response.json()
        setPresence(data.presence || {})
      }
    } catch (err) {
      console.error("[Presence] Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  // WebSocket subscription for real-time presence updates
  useEffect(() => {
    if (!wsConnected || userIds.length === 0) return

    const unsub = subscribe("presence.update", (payload: { userId: string; isOnline: boolean; lastSeenAt: string | null }) => {
      if (userIds.includes(payload.userId)) {
        setPresence((prev) => ({
          ...prev,
          [payload.userId]: { isOnline: payload.isOnline, lastSeenAt: payload.lastSeenAt },
        }))
      }
    })

    return unsub
  }, [wsConnected, subscribe, userIdsKey])

  // Initial fetch
  useEffect(() => {
    if (userIds.length === 0) {
      setPresence({})
      return
    }
    fetchPresence()
  }, [userIdsKey])

  // Polling fallback — only when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected || userIds.length === 0) return

    const interval = setInterval(fetchPresence, 30000)
    return () => clearInterval(interval)
  }, [wsConnected, userIdsKey])

  return { presence, loading }
}
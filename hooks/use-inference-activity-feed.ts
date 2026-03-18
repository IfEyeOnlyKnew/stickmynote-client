"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useUser } from "@/contexts/user-context"
import { useWebSocket } from "@/hooks/useWebSocket"

export interface ActivityMetadata {
  stick_id?: string
  stick_topic?: string
  pad_id?: string
  pad_name?: string
  reply_content?: string
  old_value?: string
  new_value?: string
}

export interface InferenceActivity {
  id: string
  activity_type: "created" | "updated" | "replied" | "shared"
  created_at: string
  user_id: string
  metadata?: ActivityMetadata
  user?: {
    full_name: string | null
    email: string
  }
  social_stick?: {
    id: string
    topic: string
    content: string
    social_pad_id: string
    social_pads: {
      name: string
    }
  }
}

export function useInferenceActivityFeed() {
  const { user } = useUser()
  const [activities, setActivities] = useState<InferenceActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchActivities = useCallback(
    async (reset = false) => {
      try {
        if (!user) return

        const currentOffset = reset ? 0 : offset
        const response = await fetch(`/api/inference-activity-feed?limit=20&offset=${currentOffset}`)

        if (response.ok) {
          const data = await response.json()
          if (reset) {
            setActivities(data.activities || [])
          } else {
            setActivities((prev) => [...prev, ...(data.activities || [])])
          }
          setHasMore(data.hasMore)
          setOffset(reset ? 20 : currentOffset + 20)
        }
      } catch (error) {
        console.error("Error fetching inference activities:", error)
      } finally {
        setLoading(false)
      }
    },
    [offset, user],
  )

  // WebSocket subscription for real-time inference activity updates
  const { connected: wsConnected, subscribe } = useWebSocket()

  useEffect(() => {
    if (!wsConnected) return

    const unsub = subscribe("social_activity.new", () => {
      fetchActivities(true)
    })

    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, subscribe])

  // Initial fetch
  useEffect(() => {
    fetchActivities(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling fallback — only when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected) return

    pollIntervalRef.current = setInterval(() => {
      fetchActivities(true)
    }, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected])

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchActivities(false)
    }
  }

  return {
    activities,
    loading,
    hasMore,
    loadMore,
    refresh: () => fetchActivities(true),
  }
}

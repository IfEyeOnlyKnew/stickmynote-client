"use client"

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/user-context"
import { useWebSocket } from "@/hooks/useWebSocket"

export function useLikes(targetId: string, targetType: "stick" | "reply" = "stick") {
  const { user } = useUser()
  const [likeCount, setLikeCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { connected: wsConnected, subscribe } = useWebSocket()

  // WebSocket subscription for real-time like updates
  useEffect(() => {
    if (!wsConnected || !targetId) return

    const unsubs = [
      subscribe("like.added", (payload: any) => {
        if (payload.targetId === targetId) {
          setLikeCount((prev) => prev + 1)
          if (user && payload.userId === user.id) setIsLiked(true)
        }
      }),
      subscribe("like.removed", (payload: any) => {
        if (payload.targetId === targetId) {
          setLikeCount((prev) => Math.max(0, prev - 1))
          if (user && payload.userId === user.id) setIsLiked(false)
        }
      }),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [wsConnected, subscribe, targetId, user])

  // Initial fetch
  useEffect(() => {
    if (!targetId) return
    fetchLikes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType])

  // Polling fallback — only when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected || !targetId) return

    pollIntervalRef.current = setInterval(fetchLikes, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, targetId, targetType])

  const fetchLikes = async () => {
    try {
      const endpoint =
        targetType === "stick"
          ? `/api/inference-sticks/${targetId}/reactions`
          : `/api/inference-stick-replies/${targetId}/reactions`

      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()

        const heartReactions = data.reactions?.filter((r: any) => r.reaction_type === "heart") || []
        setLikeCount(heartReactions.length)

        // Check if current user has liked
        if (user) {
          const userHasLiked = heartReactions.some((r: any) => r.user_id === user.id)
          setIsLiked(userHasLiked)
        }
      }
    } catch (error) {
      console.error("Error fetching likes:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleLike = async () => {
    try {
      const endpoint =
        targetType === "stick"
          ? `/api/inference-sticks/${targetId}/reactions`
          : `/api/inference-stick-replies/${targetId}/reactions`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: "heart" }),
      })

      if (response.ok) {
        await fetchLikes()
      }
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  return {
    likeCount,
    isLiked,
    loading,
    toggleLike,
  }
}

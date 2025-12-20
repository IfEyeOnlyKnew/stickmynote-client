"use client"

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/user-context"

export function useLikes(targetId: string, targetType: "stick" | "reply" = "stick") {
  const { user } = useUser()
  const [likeCount, setLikeCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!targetId) return

    fetchLikes()

    // Poll for updates every 30 seconds instead of realtime subscription
    pollIntervalRef.current = setInterval(fetchLikes, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType])

  const fetchLikes = async () => {
    try {
      const endpoint =
        targetType === "stick"
          ? `/api/social-sticks/${targetId}/reactions`
          : `/api/social-stick-replies/${targetId}/reactions`

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
          ? `/api/social-sticks/${targetId}/reactions`
          : `/api/social-stick-replies/${targetId}/reactions`

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

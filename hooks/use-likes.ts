"use client"

import { useState, useEffect } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

export function useLikes(targetId: string, targetType: "stick" | "reply" = "stick") {
  const [likeCount, setLikeCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!targetId) return

    fetchLikes()

    const supabase = createSupabaseBrowser()
    const tableName = targetType === "stick" ? "social_stick_reactions" : "social_reply_reactions"
    const filterColumn = targetType === "stick" ? "social_stick_id" : "social_reply_id"

    const channel = supabase
      .channel(`likes:${targetType}:${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: `${filterColumn}=eq.${targetId}`,
        },
        () => {
          fetchLikes()
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
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
        const supabase = createSupabaseBrowser()
        const {
          data: { user },
        } = await supabase.auth.getUser()

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

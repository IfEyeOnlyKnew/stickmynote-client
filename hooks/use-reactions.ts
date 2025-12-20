"use client"

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/user-context"

export interface Reaction {
  id: string
  user_id: string
  reaction_type: string
  created_at: string
  users?: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
  }
}

export interface ReactionCounts {
  [key: string]: number
}

export function useReactions(targetId: string, targetType: "stick" | "reply" = "stick") {
  const { user } = useUser()
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({})
  const [loading, setLoading] = useState(true)
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set())
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!targetId) return

    fetchReactions()

    // Poll for updates every 30 seconds instead of realtime subscription
    pollIntervalRef.current = setInterval(fetchReactions, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType])

  const fetchReactions = async () => {
    try {
      const endpoint =
        targetType === "stick"
          ? `/api/social-sticks/${targetId}/reactions`
          : `/api/social-stick-replies/${targetId}/reactions`

      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        setReactions(data.reactions || [])
        setReactionCounts(data.reactionCounts || {})

        // Track user's reactions using context user
        if (user) {
          const userReactionTypes: string[] =
            data.reactions?.filter((r: Reaction) => r.user_id === user.id).map((r: Reaction) => r.reaction_type) || []
          const userReactionSet = new Set<string>(userReactionTypes)
          setUserReactions(userReactionSet)
        }
      }
    } catch (error) {
      console.error("Error fetching reactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleReaction = async (reactionType: string) => {
    try {
      const endpoint =
        targetType === "stick"
          ? `/api/social-sticks/${targetId}/reactions`
          : `/api/social-stick-replies/${targetId}/reactions`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: reactionType }),
      })

      if (response.ok) {
        await fetchReactions()
      }
    } catch (error) {
      console.error("Error toggling reaction:", error)
    }
  }

  return {
    reactions,
    reactionCounts,
    loading,
    toggleReaction,
    userReactions,
  }
}

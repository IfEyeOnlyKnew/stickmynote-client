"use client"

import { useState, useEffect, useCallback } from "react"

interface Subscription {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  is_following: boolean
  channel_preferences: {
    inApp?: boolean
    email?: boolean
    webhook?: boolean
  }
  notification_level: string
  channel_in_app: boolean
  channel_email: boolean
  channel_webhook: boolean
  notify_replies: boolean
  notify_updates: boolean
  notify_mentions: boolean
  notify_status_changes: boolean
  created_at: string
  updated_at: string
}

interface UseFollowOptions {
  entityType: "stick" | "pad" | "social_stick" | "social_pad"
  entityId: string
}

interface FollowChannels {
  inApp: boolean
  email: boolean
  webhook: boolean
}

function normalizeEntityType(entityType: string): "stick" | "pad" {
  if (entityType === "social_stick" || entityType === "stick") {
    return "stick"
  }
  return "pad"
}

export function useFollow({ entityType, entityId }: UseFollowOptions) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizedType = normalizeEntityType(entityType)

  const fetchSubscription = useCallback(async () => {
    if (!entityId) {
      setIsLoading(false)
      return
    }

    try {
      setError(null)
      const response = await fetch(`/api/subscriptions?entityType=${normalizedType}&entityId=${entityId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        const sub = data.subscriptions?.[0] || null
        setSubscription(sub)
        setIsFollowing(!!sub && sub.is_following !== false)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Error fetching subscription:", errorData)
        setError(errorData.error || "Failed to fetch subscription")
      }
    } catch (err) {
      console.error("Error fetching subscription:", err)
      setError("Failed to fetch subscription")
    } finally {
      setIsLoading(false)
    }
  }, [normalizedType, entityId])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const follow = useCallback(
    async (channels?: Partial<FollowChannels>) => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            entityType: normalizedType,
            entityId,
            channels: {
              inApp: channels?.inApp ?? true,
              email: channels?.email ?? false,
              webhook: channels?.webhook ?? false,
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setSubscription(data.subscription)
          setIsFollowing(true)
          return true
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error("Follow error:", errorData)
          setError(errorData.error || "Failed to follow")
          return false
        }
      } catch (err) {
        console.error("Error following:", err)
        setError("Failed to follow")
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [normalizedType, entityId],
  )

  const unfollow = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/subscriptions?entityType=${normalizedType}&entityId=${entityId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        setSubscription(null)
        setIsFollowing(false)
        return true
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Unfollow error:", errorData)
        setError(errorData.error || "Failed to unfollow")
        return false
      }
    } catch (err) {
      console.error("Error unfollowing:", err)
      setError("Failed to unfollow")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [normalizedType, entityId])

  const updateChannels = useCallback(
    async (channels: Partial<FollowChannels>) => {
      if (!subscription) return false
      return follow(channels)
    },
    [subscription, follow],
  )

  return {
    isFollowing,
    subscription,
    isLoading,
    error,
    follow,
    unfollow,
    updateChannels,
    refresh: fetchSubscription,
  }
}

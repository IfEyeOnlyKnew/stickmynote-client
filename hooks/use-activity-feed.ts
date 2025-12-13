"use client"

import { useState, useEffect, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import type { Activity, ActivityFeedGroup } from "@/types/activity"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export function useActivityFeed(userId: string | null) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [groupedActivities, setGroupedActivities] = useState<ActivityFeedGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const supabase = createSupabaseBrowser()

  const groupActivitiesByDate = useCallback((acts: Activity[]): ActivityFeedGroup[] => {
    const groups: Record<string, Activity[]> = {}

    acts.forEach((activity) => {
      const date = parseISO(activity.created_at)
      let dateLabel: string

      if (isToday(date)) {
        dateLabel = "Today"
      } else if (isYesterday(date)) {
        dateLabel = "Yesterday"
      } else {
        dateLabel = format(date, "MMMM d, yyyy")
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = []
      }
      groups[dateLabel].push(activity)
    })

    return Object.entries(groups).map(([date, activities]) => ({
      date,
      activities,
    }))
  }, [])

  const fetchActivities = useCallback(
    async (offset = 0) => {
      if (!userId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/activity-feed?limit=50&offset=${offset}`)

        if (!response.ok) {
          throw new Error("Failed to fetch activity feed")
        }

        const data = await response.json()

        if (offset === 0) {
          setActivities(data.activities)
        } else {
          setActivities((prev) => [...prev, ...data.activities])
        }

        setHasMore(data.hasMore)
        setError(null)
      } catch (err) {
        console.error("Error fetching activity feed:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch activity feed")
      } finally {
        setLoading(false)
      }
    },
    [userId],
  )

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    fetchActivities(activities.length)
  }, [activities.length, hasMore, loading, fetchActivities])

  useEffect(() => {
    setGroupedActivities(groupActivitiesByDate(activities))
  }, [activities, groupActivitiesByDate])

  useEffect(() => {
    if (!userId) return

    const setupRealtimeSubscription = async () => {
      const channel: RealtimeChannel = supabase
        .channel(`activity-feed:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "personal_sticks_activities",
            filter: `user_id=eq.${userId}`,
          },
          (payload: RealtimePostgresChangesPayload<Activity>) => {
            const newActivity = payload.new as Activity
            setActivities((prev) => [newActivity, ...prev])
          },
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    }

    fetchActivities()
    const cleanup = setupRealtimeSubscription()

    return () => {
      cleanup.then((fn) => fn && fn())
    }
  }, [userId, fetchActivities, supabase])

  return {
    activities,
    groupedActivities,
    loading,
    error,
    hasMore,
    fetchActivities,
    loadMore,
  }
}

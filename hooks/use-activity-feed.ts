"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Activity, ActivityFeedGroup } from "@/types/activity"
import { format, isToday, isYesterday, parseISO } from "date-fns"

// ============================================================================
// Types
// ============================================================================

interface ActivityFeedState {
  activities: Activity[]
  loading: boolean
  error: string | null
  hasMore: boolean
}

interface FetchActivitiesResponse {
  activities: Activity[]
  hasMore: boolean
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMIT = 50
const DEFAULT_OFFSET = 0

// ============================================================================
// Helpers
// ============================================================================

function getDateLabel(date: Date): string {
  if (isToday(date)) {
    return "Today"
  }
  if (isYesterday(date)) {
    return "Yesterday"
  }
  return format(date, "MMMM d, yyyy")
}

function groupActivitiesByDate(activities: Activity[]): ActivityFeedGroup[] {
  const groups: Record<string, Activity[]> = {}

  for (const activity of activities) {
    const date = parseISO(activity.created_at)
    const dateLabel = getDateLabel(date)

    if (!groups[dateLabel]) {
      groups[dateLabel] = []
    }
    groups[dateLabel].push(activity)
  }

  return Object.entries(groups).map(([date, activities]) => ({
    date,
    activities,
  }))
}

// ============================================================================
// Hook
// ============================================================================

export function useActivityFeed(userId: string | null) {
  const [state, setState] = useState<ActivityFeedState>({
    activities: [],
    loading: true,
    error: null,
    hasMore: false,
  })

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Derived state
  const groupedActivities = useMemo(
    () => groupActivitiesByDate(state.activities),
    [state.activities]
  )

  // Fetch activities from API
  const fetchActivities = useCallback(
    async (offset = DEFAULT_OFFSET) => {
      if (!userId) return

      try {
        setState((prev) => ({ ...prev, loading: true }))

        const response = await fetch(`/api/activity-feed?limit=${DEFAULT_LIMIT}&offset=${offset}`)

        if (!response.ok) {
          throw new Error("Failed to fetch activity feed")
        }

        const data: FetchActivitiesResponse = await response.json()

        setState((prev) => ({
          ...prev,
          activities: offset === 0 ? data.activities : [...prev.activities, ...data.activities],
          hasMore: data.hasMore,
          error: null,
          loading: false,
        }))
      } catch (err) {
        console.error("[ActivityFeed] Error fetching:", err)
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to fetch activity feed",
          loading: false,
        }))
      }
    },
    [userId]
  )

  // Load more activities
  const loadMore = useCallback(() => {
    if (!state.hasMore || state.loading) return
    fetchActivities(state.activities.length)
  }, [state.activities.length, state.hasMore, state.loading, fetchActivities])

  // Setup polling instead of realtime subscription
  useEffect(() => {
    if (!userId) return

    fetchActivities()

    // Poll every 30 seconds for new activities
    pollIntervalRef.current = setInterval(() => {
      fetchActivities()
    }, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [userId, fetchActivities])

  return {
    activities: state.activities,
    groupedActivities,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    fetchActivities,
    loadMore,
  }
}

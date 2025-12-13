"use client"

import { useEffect, useState, useCallback } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

export interface ActivityMetadata {
  stick_id?: string
  stick_topic?: string
  pad_id?: string
  pad_name?: string
  reply_content?: string
  old_value?: string
  new_value?: string
}

export interface SocialActivity {
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

export function useSocialActivityFeed() {
  const [activities, setActivities] = useState<SocialActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const supabase = createSupabaseBrowser()

  const fetchActivities = useCallback(
    async (reset = false) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const currentOffset = reset ? 0 : offset
        const response = await fetch(`/api/social-activity-feed?limit=20&offset=${currentOffset}`)

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
        console.error("Error fetching social activities:", error)
      } finally {
        setLoading(false)
      }
    },
    [offset, supabase],
  )

  useEffect(() => {
    fetchActivities(true)

    const channel = supabase
      .channel("social-activity-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personal_sticks_activities",
        },
        () => {
          fetchActivities(true)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

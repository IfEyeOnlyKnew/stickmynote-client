"use client"

import { useEffect, useRef } from "react"
import { useActivityFeed } from "@/hooks/use-activity-feed"
import { ActivityItem } from "./activity-item"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, ActivityIcon } from "lucide-react"

interface ActivityFeedListProps {
  readonly userId: string | null
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function ActivityFeedList({ userId }: ActivityFeedListProps) {
  const { groupedActivities, loading, error, hasMore, loadMore } = useActivityFeed(userId)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // IntersectionObserver for auto-loading more items
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loading, loadMore])

  if (loading && groupedActivities.length === 0) {
    return (
      <div className="space-y-4">
        {["s1", "s2", "s3", "s4", "s5", "s6"].map((key) => (
          <ActivitySkeleton key={key} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (groupedActivities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ActivityIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-muted-foreground mb-2">No recent activity</p>
        <p className="text-xs text-muted-foreground">Your recent actions will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groupedActivities.map((group) => (
        <div key={group.date} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-3 sticky top-0 bg-background py-2">
            {group.date}
          </h3>
          <div className="space-y-1">
            {group.activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}

      {hasMore && <div ref={sentinelRef} className="h-4 w-full" />}
      {hasMore && loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

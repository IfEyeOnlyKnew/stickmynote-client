"use client"

import { useActivityFeed } from "@/hooks/use-activity-feed"
import { ActivityItem } from "./activity-item"
import { Button } from "@/components/ui/button"
import { Loader2, ActivityIcon } from "lucide-react"

interface ActivityFeedListProps {
  userId: string | null
}

export function ActivityFeedList({ userId }: ActivityFeedListProps) {
  const { groupedActivities, loading, error, hasMore, loadMore } = useActivityFeed(userId)

  if (loading && groupedActivities.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

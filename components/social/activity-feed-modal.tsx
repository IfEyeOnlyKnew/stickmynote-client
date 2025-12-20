"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSocialActivityFeed, type SocialActivity } from "@/hooks/use-social-activity-feed"
import { Activity, FileText, MessageSquare, Share2, Edit, RefreshCw } from "lucide-react"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"
import { StickDetailModal } from "@/components/social/stick-detail-modal"

interface ActivityFeedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivityFeedModal({ open, onOpenChange }: ActivityFeedModalProps) {
  const { activities, loading, hasMore, loadMore, refresh } = useSocialActivityFeed()
  const [selectedStickId, setSelectedStickId] = useState<string | null>(null)

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "created":
        return <FileText className="h-4 w-4" />
      case "updated":
        return <Edit className="h-4 w-4" />
      case "replied":
        return <MessageSquare className="h-4 w-4" />
      case "shared":
        return <Share2 className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getActivityMessage = (activity: SocialActivity) => {
    const userName = activity.user?.full_name || activity.user?.email || "Someone"
    const stickTopic = activity.social_stick?.topic || "a stick"
    const padName = activity.social_stick?.social_pads?.name || "a pad"

    switch (activity.activity_type) {
      case "created":
        return (
          <>
            <span className="font-semibold">{userName}</span> created a new stick{" "}
            <span className="font-medium">&quot;{stickTopic}&quot;</span> in {padName}
          </>
        )
      case "updated":
        return (
          <>
            <span className="font-semibold">{userName}</span> updated the stick{" "}
            <span className="font-medium">&quot;{stickTopic}&quot;</span> in {padName}
          </>
        )
      case "replied":
        return (
          <>
            <span className="font-semibold">{userName}</span> replied to{" "}
            <span className="font-medium">&quot;{stickTopic}&quot;</span> in {padName}
          </>
        )
      case "shared":
        return (
          <>
            <span className="font-semibold">{userName}</span> shared the stick{" "}
            <span className="font-medium">&quot;{stickTopic}&quot;</span>
          </>
        )
      default:
        return (
          <>
            <span className="font-semibold">{userName}</span> performed an action
          </>
        )
    }
  }

  const groupActivitiesByDate = () => {
    const grouped = new Map<string, SocialActivity[]>()

    activities.forEach((activity) => {
      const date = new Date(activity.created_at)
      let label: string

      if (isToday(date)) {
        label = "Today"
      } else if (isYesterday(date)) {
        label = "Yesterday"
      } else {
        label = format(date, "MMMM d, yyyy")
      }

      if (!grouped.has(label)) {
        grouped.set(label, [])
      }
      grouped.get(label)!.push(activity)
    })

    return grouped
  }

  const groupedActivities = groupActivitiesByDate()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">Social Activity</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">Recent activity from the last 90 days</p>
              </div>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[calc(80vh-120px)] px-6">
            {loading && activities.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
                <p className="text-gray-600">Activities from your social pads will appear here</p>
              </div>
            ) : (
              <div className="space-y-8 pb-6">
                {Array.from(groupedActivities.entries()).map(([date, dateActivities]) => (
                  <div key={date} className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 sticky top-0 bg-white py-2 z-10">{date}</h2>
                    <div className="space-y-3">
                      {dateActivities.map((activity) => (
                        <Card
                          key={activity.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            if (activity.metadata?.stick_id) {
                              setSelectedStickId(activity.metadata.stick_id)
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                  {getActivityIcon(activity.activity_type)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 mb-1">{getActivityMessage(activity)}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {activity.activity_type}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div className="flex justify-center pb-4">
                    <Button variant="outline" onClick={loadMore} disabled={loading}>
                      {loading ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedStickId && (
        <StickDetailModal
          stickId={selectedStickId}
          open={!!selectedStickId}
          onOpenChange={(open) => {
            if (!open) setSelectedStickId(null)
          }}
        />
      )}
    </>
  )
}

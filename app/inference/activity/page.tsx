"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useUser } from "@/contexts/user-context"
import { useInferenceActivityFeed, type InferenceActivity } from "@/hooks/use-inference-activity-feed"
import { Activity, FileText, MessageSquare, Share2, Edit, RefreshCw } from "lucide-react"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"
import { StickDetailModal } from "@/components/inference/stick-detail-modal"

export default function InferenceActivityPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { activities, loading, hasMore, loadMore, refresh } = useInferenceActivityFeed()
  const [selectedStickId, setSelectedStickId] = useState<string | null>(null)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth")
    }
  }, [user, userLoading, router])

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

  const getActivityMessage = (activity: InferenceActivity) => {
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
    const grouped = new Map<string, InferenceActivity[]>()

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

  if (userLoading || (loading && activities.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!user) return null

  const groupedActivities = groupActivitiesByDate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Inference", href: "/inference" },
            { label: "Activity", current: true },
          ]}
        />

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Inference Activity</h1>
            <p className="text-gray-600">Recent activity from the last 90 days</p>
          </div>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {activities.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
              <p className="text-gray-600 mb-4">Activities from your inference pads will appear here</p>
              <Button onClick={() => router.push("/inference")}>Go to Inference Hub</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Array.from(groupedActivities.entries()).map(([date, dateActivities]) => (
              <div key={date} className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 sticky top-0 bg-gray-50 py-2 z-10">{date}</h2>
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
              <div className="flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedStickId && (
        <StickDetailModal
          stickId={selectedStickId}
          open={!!selectedStickId}
          onOpenChange={(open) => {
            if (!open) setSelectedStickId(null)
          }}
        />
      )}
    </div>
  )
}

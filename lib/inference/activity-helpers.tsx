import type React from "react"
import { Activity, FileText, MessageSquare, Share2, Edit } from "lucide-react"
import { format, isToday, isYesterday } from "date-fns"
import type { InferenceActivity } from "@/hooks/use-inference-activity-feed"

export function getActivityIcon(type: string): React.ReactNode {
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

export function getActivityMessage(activity: InferenceActivity): React.ReactNode {
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

export function groupActivitiesByDate(activities: InferenceActivity[]): Map<string, InferenceActivity[]> {
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

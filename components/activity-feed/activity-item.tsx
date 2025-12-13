"use client"

import { StickyNote, MessageSquare, Edit, Share2, Tag, Users } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Activity } from "@/types/activity"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface ActivityItemProps {
  activity: Activity
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const router = useRouter()

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case "note_created":
        return <StickyNote className="h-4 w-4 text-green-600" />
      case "note_updated":
        return <Edit className="h-4 w-4 text-blue-600" />
      case "reply_added":
        return <MessageSquare className="h-4 w-4 text-purple-600" />
      case "note_shared":
        return <Share2 className="h-4 w-4 text-orange-600" />
      case "tag_added":
        return <Tag className="h-4 w-4 text-pink-600" />
      case "pad_joined":
        return <Users className="h-4 w-4 text-indigo-600" />
      default:
        return <StickyNote className="h-4 w-4 text-gray-600" />
    }
  }

  const getActivityMessage = () => {
    const userName = activity.user_full_name || activity.user_email || "Someone"
    const noteTopic = activity.note_topic || "Untitled"

    switch (activity.activity_type) {
      case "note_created":
        return (
          <>
            <span className="font-medium">{userName}</span> created a note{" "}
            <span className="font-medium">"{noteTopic}"</span>
          </>
        )
      case "note_updated":
        const changes = []
        if (activity.metadata?.topic_changed) changes.push("topic")
        if (activity.metadata?.sharing_changed) changes.push("sharing")
        if (activity.metadata?.color_changed) changes.push("color")

        return (
          <>
            <span className="font-medium">{userName}</span> updated {changes.length > 0 && `${changes.join(", ")} of `}
            <span className="font-medium">"{noteTopic}"</span>
          </>
        )
      case "reply_added":
        return (
          <>
            <span className="font-medium">{userName}</span> replied to{" "}
            <span className="font-medium">"{noteTopic}"</span>
          </>
        )
      case "note_shared":
        return (
          <>
            <span className="font-medium">{userName}</span> shared <span className="font-medium">"{noteTopic}"</span>
          </>
        )
      case "tag_added":
        return (
          <>
            <span className="font-medium">{userName}</span> added tags to{" "}
            <span className="font-medium">"{noteTopic}"</span>
          </>
        )
      case "pad_joined":
        return (
          <>
            <span className="font-medium">{userName}</span> joined a pad
          </>
        )
      default:
        return (
          <>
            <span className="font-medium">{userName}</span> performed an action
          </>
        )
    }
  }

  const handleClick = () => {
    if (activity.note_id) {
      router.push(`/notes?note=${activity.note_id}`)
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors",
        activity.note_id && "cursor-pointer",
      )}
      onClick={handleClick}
    >
      <div className="p-2 rounded-full bg-muted flex-shrink-0">{getActivityIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">{getActivityMessage()}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Clock,
  Heart,
  MessageCircle,
  MessagesSquare,
  Video,
  Pin,
  PinOff,
  Settings,
} from "lucide-react"
import type { InferenceStick } from "@/types/inference-pad"

interface StickCardProps {
  stick: InferenceStick
  isPinned: boolean
  canManageSticks: boolean
  onStickClick: (stickId: string) => void
  onChatClick: (e: React.MouseEvent, stickTopic: string) => void
  onVideoClick: (e: React.MouseEvent) => void
  onPinToggle: (e: React.MouseEvent, stickId: string) => void
  onManageMembers: (e: React.MouseEvent, stick: InferenceStick) => void
  scheduleMeetingButton?: React.ReactNode
}

export function StickCard({
  stick,
  isPinned,
  canManageSticks,
  onStickClick,
  onChatClick,
  onVideoClick,
  onPinToggle,
  onManageMembers,
  scheduleMeetingButton,
}: Readonly<StickCardProps>) {
  const replyCount = stick.social_stick_replies?.[0]?.count || 0
  const reactionCount = stick.reaction_counts
    ? Object.values(stick.reaction_counts).reduce((sum, count) => sum + count, 0)
    : 0

  const cardClassName = isPinned
    ? "cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 border-amber-300 overflow-hidden group bg-gradient-to-br from-amber-50 to-white shadow-lg"
    : "cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 border-gray-300 overflow-hidden group bg-white shadow-lg"

  const borderClassName = isPinned ? "border-amber-200/50" : "border-gray-200/50"

  return (
    <Card
      className={cardClassName}
      onClick={() => onStickClick(stick.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold line-clamp-2 group-hover:text-purple-600 transition-colors">
            {stick.topic}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => onChatClick(e, stick.topic)}
              title="New chat"
            >
              <MessagesSquare className="h-4 w-4 text-purple-500 hover:text-purple-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onVideoClick}
              title="Start video call"
            >
              <Video className="h-4 w-4 text-blue-500 hover:text-blue-600" />
            </Button>
            {scheduleMeetingButton}
            {canManageSticks && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => onPinToggle(e, stick.id)}
                  title={isPinned ? "Unpin this stick" : "Pin this stick"}
                >
                  {isPinned ? (
                    <PinOff className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Pin className="h-4 w-4 text-gray-400 hover:text-amber-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => onManageMembers(e, stick)}
                  title="Manage stick settings and members"
                >
                  <Settings className="h-4 w-4 text-gray-600" />
                </Button>
              </>
            )}
            {isPinned && <Pin className="h-4 w-4 text-amber-500 flex-shrink-0" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{stick.content}</p>
        <div className={`flex items-center justify-between pt-2 border-t ${borderClassName}`}>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {new Date(stick.created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Heart className="h-3 w-3" />
              <span>{reactionCount}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MessageCircle className="h-3 w-3" />
              <span>{replyCount}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

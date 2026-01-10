"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Check, Clock, Calendar, X, Loader2 } from "lucide-react"
import type { ChatRequest, ChatRequestStatus } from "@/types/chat-request"

interface ChatInvitationNotificationProps {
  request: ChatRequest
  open: boolean
  onOpenChange: (open: boolean) => void
  onRespond: (requestId: string, status: ChatRequestStatus, message?: string) => Promise<boolean>
}

export function ChatInvitationNotification({
  request,
  open,
  onOpenChange,
  onRespond,
}: ChatInvitationNotificationProps) {
  const [isResponding, setIsResponding] = useState(false)
  const [responseStatus, setResponseStatus] = useState<ChatRequestStatus | null>(null)
  const [showMeetingInput, setShowMeetingInput] = useState(false)
  const [meetingMessage, setMeetingMessage] = useState("")

  const requesterName =
    request.requester?.full_name ||
    request.requester?.username ||
    request.requester?.email ||
    "Someone"

  const requesterInitials = requesterName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const replyPreview = request.parent_reply?.content
    ? request.parent_reply.content.length > 100
      ? request.parent_reply.content.slice(0, 100) + "..."
      : request.parent_reply.content
    : "a discussion thread"

  const handleRespond = async (status: ChatRequestStatus, message?: string) => {
    setIsResponding(true)
    setResponseStatus(status)

    const success = await onRespond(request.id, status, message)

    setIsResponding(false)
    setResponseStatus(null)

    if (success) {
      onOpenChange(false)
    }
  }

  const handleScheduleMeeting = () => {
    setShowMeetingInput(true)
  }

  const handleSendMeetingLink = async () => {
    await handleRespond("schedule_meeting", meetingMessage || "Let's schedule a meeting")
    setShowMeetingInput(false)
    setMeetingMessage("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-purple-500" />
            Chat Request
          </DialogTitle>
          <DialogDescription>
            {requesterName} wants to start a chat with you
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Requester info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.requester?.avatar_url || undefined} />
              <AvatarFallback className="bg-purple-100 text-purple-700">
                {requesterInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{requesterName}</p>
              {request.requester?.email && (
                <p className="text-sm text-gray-500 truncate">
                  {request.requester.email}
                </p>
              )}
            </div>
          </div>

          {/* Reply context */}
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-xs text-purple-600 font-medium mb-1">
              Continuing from:
            </p>
            <p className="text-sm text-gray-700">{replyPreview}</p>
          </div>

          {/* Meeting link input (conditional) */}
          {showMeetingInput && (
            <div className="space-y-2">
              <Textarea
                placeholder="Add a meeting link or message (optional)"
                value={meetingMessage}
                onChange={(e) => setMeetingMessage(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSendMeetingLink}
                  disabled={isResponding}
                >
                  {isResponding && responseStatus === "schedule_meeting" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Send
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMeetingInput(false)}
                  disabled={isResponding}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Response buttons */}
          {!showMeetingInput && (
            <div className="grid grid-cols-2 gap-2">
              {/* Accept - Primary action */}
              <Button
                className="col-span-2 bg-green-600 hover:bg-green-700"
                onClick={() => handleRespond("accepted")}
                disabled={isResponding}
              >
                {isResponding && responseStatus === "accepted" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Accept & Start Chat
              </Button>

              {/* Give me 5 minutes */}
              <Button
                variant="outline"
                className="border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-700"
                onClick={() => handleRespond("give_me_5_minutes")}
                disabled={isResponding}
              >
                {isResponding && responseStatus === "give_me_5_minutes" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                5 Minutes
              </Button>

              {/* Schedule Meeting */}
              <Button
                variant="outline"
                className="border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700"
                onClick={handleScheduleMeeting}
                disabled={isResponding}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>

              {/* Busy */}
              <Button
                variant="outline"
                className="col-span-2"
                onClick={() => handleRespond("busy")}
                disabled={isResponding}
              >
                {isResponding && responseStatus === "busy" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                I'm Busy
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

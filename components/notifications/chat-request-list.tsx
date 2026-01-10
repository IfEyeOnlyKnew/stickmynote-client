"use client"

import { useState } from "react"
import { useChatRequests } from "@/hooks/useChatRequests"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, MessageCircle, Check, Clock, Calendar, X } from "lucide-react"
import { ChatInvitationNotification } from "@/components/chat/ChatInvitationNotification"
import type { ChatRequest, ChatRequestStatus } from "@/types/chat-request"
import { getTimestampDisplay } from "@/utils/noteUtils"

export function ChatRequestList() {
  const { incomingRequests, loading, respondToRequest } = useChatRequests()
  const [selectedRequest, setSelectedRequest] = useState<ChatRequest | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const handleRespond = async (requestId: string, status: ChatRequestStatus, message?: string) => {
    setRespondingId(requestId)
    const success = await respondToRequest(requestId, status, message)
    setRespondingId(null)
    if (success) {
      setSelectedRequest(null)
    }
    return success
  }

  const handleQuickAccept = async (request: ChatRequest) => {
    await handleRespond(request.id, "accepted")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (incomingRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-muted-foreground">No chat requests</p>
        <p className="text-xs text-muted-foreground mt-1">When someone wants to chat, it will appear here</p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="max-h-[400px]">
        <div className="divide-y">
          {incomingRequests.map((request) => {
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
              ? request.parent_reply.content.length > 60
                ? request.parent_reply.content.slice(0, 60) + "..."
                : request.parent_reply.content
              : "a discussion"

            const isResponding = respondingId === request.id

            return (
              <div
                key={request.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={request.requester?.avatar_url || undefined} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
                      {requesterInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {requesterName}
                      </p>
                      <span className="text-xs text-gray-400">
                        {getTimestampDisplay(request.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      wants to chat about:
                    </p>
                    <p className="text-xs text-gray-500 italic truncate mt-0.5">
                      "{replyPreview}"
                    </p>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => handleQuickAccept(request)}
                        disabled={isResponding}
                      >
                        {isResponding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setSelectedRequest(request)}
                        disabled={isResponding}
                      >
                        More options
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Full invitation modal for selected request */}
      {selectedRequest && (
        <ChatInvitationNotification
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          onRespond={handleRespond}
        />
      )}
    </>
  )
}

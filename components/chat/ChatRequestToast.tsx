"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MessageCircle, X } from "lucide-react"
import type { ChatRequest } from "@/types/chat-request"

interface ChatRequestToastProps {
  request: ChatRequest
  onView: (request: ChatRequest) => void
  onDismiss: (requestId: string) => void
  autoDismissMs?: number
}

export function ChatRequestToast({
  request,
  onView,
  onDismiss,
  autoDismissMs = 10000,
}: ChatRequestToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

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
    ? request.parent_reply.content.length > 50
      ? request.parent_reply.content.slice(0, 50) + "..."
      : request.parent_reply.content
    : "a discussion"

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, autoDismissMs)

    return () => clearTimeout(timer)
  }, [autoDismissMs])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onDismiss(request.id)
    }, 300)
  }

  const handleView = () => {
    onView(request)
    handleDismiss()
  }

  if (!isVisible) return null

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        max-w-sm w-full
        bg-white rounded-lg shadow-lg border border-gray-200
        transform transition-all duration-300 ease-out
        ${isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}
      `}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 rounded-t-lg overflow-hidden">
        <div
          className="h-full bg-purple-500 animate-shrink-width"
          style={{
            animationDuration: `${autoDismissMs}ms`,
          }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 p-2 bg-purple-100 rounded-full">
            <MessageCircle className="h-5 w-5 text-purple-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-6 w-6">
                <AvatarImage src={request.requester?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                  {requesterInitials}
                </AvatarFallback>
              </Avatar>
              <p className="font-medium text-gray-900 text-sm truncate">
                {requesterName}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              wants to start a chat about:
            </p>
            <p className="text-sm text-gray-500 italic truncate mt-0.5">
              "{replyPreview}"
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 ml-11">
          <Button
            size="sm"
            onClick={handleView}
            className="bg-purple-600 hover:bg-purple-700"
          >
            View Request
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
          >
            Later
          </Button>
        </div>
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes shrink-width {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-shrink-width {
          animation: shrink-width linear forwards;
        }
      `}</style>
    </div>
  )
}

// Container component to manage multiple toasts
interface ChatRequestToastsProps {
  requests: ChatRequest[]
  onView: (request: ChatRequest) => void
  onDismiss: (requestId: string) => void
}

export function ChatRequestToasts({
  requests,
  onView,
  onDismiss,
}: ChatRequestToastsProps) {
  // Only show the most recent request as a toast
  const latestRequest = requests[0]

  if (!latestRequest) return null

  return (
    <ChatRequestToast
      key={latestRequest.id}
      request={latestRequest}
      onView={onView}
      onDismiss={onDismiss}
    />
  )
}

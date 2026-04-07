"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, FileText, Loader2, X, CornerDownRight, Clock, Calendar, MessageCircle } from "lucide-react"
import { getTimestampDisplay } from "@/utils/noteUtils"
import { useCSRF } from "@/hooks/useCSRF"
import type { ChatRequest } from "@/types/chat-request"

interface ChatMessage {
  id: string
  content: string
  created_at: string
  updated_at?: string
  user_id: string
  parent_reply_id: string
  user?: {
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string
  }
}

interface ParentReply {
  id: string
  content: string
  user_id?: string
  user?: {
    username?: string
    email?: string
    full_name?: string
  }
}

type InvitationPhase = "none" | "sending" | "pending" | "accepted" | "busy" | "schedule_meeting" | "give_me_5_minutes"

interface ChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentReply: ParentReply
  parentNoteId: string
  context: "note" | "stick"
  currentUserId: string
  /** If true, skip invitation flow and open chat directly (for when invitation is already accepted) */
  skipInvitation?: boolean
  /** Existing chat request if continuing from an accepted invitation */
  existingRequest?: ChatRequest
}

export function ChatModal({
  open,
  onOpenChange,
  parentReply,
  parentNoteId,
  context,
  currentUserId,
  skipInvitation = false,
  existingRequest,
}: Readonly<ChatModalProps>) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const requestPollingRef = useRef<NodeJS.Timeout | null>(null)
  const { csrfToken } = useCSRF()

  // Invitation flow state
  const [invitationPhase, setInvitationPhase] = useState<InvitationPhase>("none")
  const [currentRequest, setCurrentRequest] = useState<ChatRequest | null>(existingRequest || null)
  const [waitCountdown, setWaitCountdown] = useState<number | null>(null)

  // Determine if we need invitation flow
  const needsInvitation = !skipInvitation &&
    parentReply.user_id &&
    parentReply.user_id !== currentUserId &&
    !existingRequest

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!parentReply.id) return

    try {
      const response = await fetch(`/api/chat/${parentReply.id}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error)
    }
  }, [parentReply.id])

  // Send chat request invitation
  const sendInvitation = useCallback(async () => {
    if (!parentReply.user_id) return

    setInvitationPhase("sending")
    try {
      const response = await fetch("/api/chat-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          parent_reply_id: parentReply.id,
          recipient_id: parentReply.user_id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentRequest(data.request)
        setInvitationPhase("pending")
      } else {
        const error = await response.json()
        if (error.error?.includes("already exists")) {
          // Check existing request status
          await checkExistingRequest()
        } else {
          console.error("Failed to send invitation:", error)
          setInvitationPhase("none")
        }
      }
    } catch (error) {
      console.error("Error sending invitation:", error)
      setInvitationPhase("none")
    }
  }, [parentReply.id, parentReply.user_id, csrfToken])

  // Check for existing request
  const checkExistingRequest = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat-requests?role=requester`)
      if (response.ok) {
        const data = await response.json()
        const existingReq = data.requests?.find(
          (r: ChatRequest) => r.parent_reply_id === parentReply.id && r.status !== "cancelled"
        )
        if (existingReq) {
          setCurrentRequest(existingReq)
          setInvitationPhase(existingReq.status as InvitationPhase)
        }
      }
    } catch (error) {
      console.error("Error checking existing request:", error)
    }
  }, [parentReply.id])

  // Poll for request status updates
  const pollRequestStatus = useCallback(async () => {
    if (!currentRequest?.id) return

    try {
      const response = await fetch(`/api/chat-requests/${currentRequest.id}`)
      if (response.ok) {
        const data = await response.json()
        const updatedRequest = data.request
        setCurrentRequest(updatedRequest)

        if (updatedRequest.status !== "pending") {
          setInvitationPhase(updatedRequest.status as InvitationPhase)

          // Handle "give_me_5_minutes" countdown
          if (updatedRequest.status === "give_me_5_minutes" && updatedRequest.wait_until) {
            const waitUntil = new Date(updatedRequest.wait_until).getTime()
            const now = Date.now()
            const remaining = Math.max(0, Math.ceil((waitUntil - now) / 1000))
            setWaitCountdown(remaining)
          }
        }
      }
    } catch (error) {
      console.error("Error polling request status:", error)
    }
  }, [currentRequest?.id])

  // Cancel chat request
  const cancelRequest = useCallback(async () => {
    if (!currentRequest?.id) return

    try {
      const response = await fetch(`/api/chat-requests/${currentRequest.id}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      })

      if (response.ok) {
        setCurrentRequest(null)
        setInvitationPhase("none")
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Error cancelling request:", error)
    }
  }, [currentRequest?.id, csrfToken, onOpenChange])

  // Countdown timer for "give_me_5_minutes"
  useEffect(() => {
    if (waitCountdown === null || waitCountdown <= 0) return

    const timer = setInterval(() => {
      setWaitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [waitCountdown])

  // Initialize invitation flow when modal opens
  useEffect(() => {
    if (!open) {
      // Reset state when closing
      if (!existingRequest) {
        setInvitationPhase("none")
        setCurrentRequest(null)
        setWaitCountdown(null)
      }
      return
    }

    if (needsInvitation && invitationPhase === "none") {
      sendInvitation()
    }
  }, [open, needsInvitation, invitationPhase, sendInvitation, existingRequest])

  // Poll for request status when pending
  useEffect(() => {
    if (!open || invitationPhase !== "pending" || !currentRequest?.id) return

    requestPollingRef.current = setInterval(pollRequestStatus, 3000)

    return () => {
      if (requestPollingRef.current) {
        clearInterval(requestPollingRef.current)
        requestPollingRef.current = null
      }
    }
  }, [open, invitationPhase, currentRequest?.id, pollRequestStatus])

  // Poll for new messages every 5 seconds (only when invitation accepted or skipped)
  const shouldShowChat = !needsInvitation || invitationPhase === "accepted" || (invitationPhase === "give_me_5_minutes" && waitCountdown === 0)

  useEffect(() => {
    if (!open || !shouldShowChat) return

    setIsLoading(true)
    fetchMessages().finally(() => setIsLoading(false))

    pollingIntervalRef.current = setInterval(fetchMessages, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [open, shouldShowChat, fetchMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/chat/${parentReply.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      })

      if (response.ok) {
        const { message } = await response.json()
        setMessages((prev) => [...prev, message])
        setNewMessage("")
      } else {
        const error = await response.json()
        console.error("Failed to send message:", error)
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleExport = async () => {
    if (messages.length === 0) return

    setIsExporting(true)
    try {
      const response = await fetch(`/api/chat/${parentReply.id}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          noteId: parentNoteId,
          context,
          includeThreadContext: true,
        }),
      })

      if (response.ok) {
        const { exportUrl } = await response.json()
        // Open download in new tab
        window.open(exportUrl, "_blank")
      } else {
        const error = await response.json()
        console.error("Export failed:", error)
        alert("Failed to export chat: " + (error.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error exporting chat:", error)
      alert("Failed to export chat")
    } finally {
      setIsExporting(false)
    }
  }

  const getDisplayName = (msg: ChatMessage) => {
    if (!msg.user) return "User"
    return msg.user.full_name || msg.user.username || msg.user.email || "User"
  }

  const getInitials = (msg: ChatMessage) => {
    return getDisplayName(msg).substring(0, 2).toUpperCase()
  }

  const getParentDisplayName = () => {
    if (!parentReply.user) return "User"
    return parentReply.user.full_name || parentReply.user.username || parentReply.user.email || "User"
  }

  // Render invitation status UI
  const renderInvitationStatus = () => {
    const recipientName = parentReply.user?.full_name || parentReply.user?.username || parentReply.user?.email || "this user"

    switch (invitationPhase) {
      case "sending":
        return (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
            <p className="text-gray-600">Sending chat request...</p>
          </div>
        )

      case "pending":
        return (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="p-4 bg-purple-100 rounded-full mb-4">
              <MessageCircle className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting for response</h3>
            <p className="text-gray-600 mb-6">
              {recipientName} has been notified of your chat request
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for response...
            </div>
            <Button variant="outline" onClick={cancelRequest}>
              Cancel Request
            </Button>
          </div>
        )

      case "busy":
        return (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <X className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">User is busy</h3>
            <p className="text-gray-600 mb-6">
              {recipientName} is currently busy and can't chat right now
            </p>
            {currentRequest?.response_message && (
              <p className="text-sm text-gray-500 italic mb-6">
                "{currentRequest.response_message}"
              </p>
            )}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )

      case "schedule_meeting":
        return (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="p-4 bg-blue-100 rounded-full mb-4">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Let's schedule a meeting</h3>
            <p className="text-gray-600 mb-4">
              {recipientName} would prefer to schedule a meeting
            </p>
            {currentRequest?.response_message && (
              <div className="p-3 bg-blue-50 rounded-lg mb-6 max-w-sm">
                <p className="text-sm text-blue-800">{currentRequest.response_message}</p>
              </div>
            )}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )

      case "give_me_5_minutes": {
        const canProceed = waitCountdown === 0
        return (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="p-4 bg-yellow-100 rounded-full mb-4">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {canProceed ? "Ready to chat!" : "Just a moment..."}
            </h3>
            <p className="text-gray-600 mb-4">
              {canProceed
                ? `${recipientName} is now available`
                : `${recipientName} asked for a few minutes`}
            </p>
            {!canProceed && waitCountdown !== null && (
              <div className="text-2xl font-mono text-yellow-600 mb-6">
                {Math.floor(waitCountdown / 60)}:{String(waitCountdown % 60).padStart(2, "0")}
              </div>
            )}
            {canProceed ? (
              <Button onClick={() => setInvitationPhase("accepted")}>
                Start Chat
              </Button>
            ) : (
              <Button variant="outline" onClick={cancelRequest}>
                Cancel
              </Button>
            )}
          </div>
        )
      }

      default:
        return null
    }
  }

  // Show invitation status if needed
  const showInvitationUI = needsInvitation && !shouldShowChat

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] max-h-[700px] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {showInvitationUI ? "Chat Request" : "Thread Chat"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!showInvitationUI && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting || messages.length === 0}
                  className="text-xs h-8"
                >
                  {isExporting ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3 mr-1" />
                  )}
                  Export DOCX
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Show invitation status or chat content */}
        {showInvitationUI ? (
          renderInvitationStatus()
        ) : (
          <>

        {/* Thread context summary */}
        <div className="flex-shrink-0 mx-4 mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-1 text-xs text-purple-600 mb-1">
            <CornerDownRight className="h-3 w-3" />
            <span>Continuing from @{getParentDisplayName()}</span>
          </div>
          <p className="text-sm text-gray-700 line-clamp-2">
            {parentReply.content}
          </p>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation below</p>
            </div>
          )}
          {!isLoading && messages.length > 0 && (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.user_id === currentUserId ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-gray-200">
                    {getInitials(msg)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    msg.user_id === currentUserId
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${
                      msg.user_id === currentUserId ? "text-blue-100" : "text-gray-600"
                    }`}>
                      {getDisplayName(msg)}
                    </span>
                    <span className={`text-xs ${
                      msg.user_id === currentUserId ? "text-blue-200" : "text-gray-400"
                    }`}>
                      {getTimestampDisplay(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t p-4 bg-gray-50">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="resize-none min-h-[60px] max-h-[120px] bg-white"
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="self-end h-10 w-10 p-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              {newMessage.length}/1000
            </span>
            <span className="text-xs text-gray-400">
              Press Enter to send, Shift+Enter for new line
            </span>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  )
}

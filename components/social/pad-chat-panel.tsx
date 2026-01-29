"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, MessageSquare, ChevronDown, ChevronUp, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface PadMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  user?: {
    id: string
    full_name: string | null
    email: string
    avatar_url?: string | null
  }
}

interface PadChatPanelProps {
  padId: string
  currentUserId: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
}

export function PadChatPanel({
  padId,
  currentUserId,
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}: PadChatPanelProps) {
  const [messages, setMessages] = useState<PadMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/social-pads/${padId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error("[PadChat] Error fetching messages:", error)
    } finally {
      setIsLoading(false)
    }
  }, [padId])

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages()

    // Poll for new messages every 5 seconds
    pollingIntervalRef.current = setInterval(fetchMessages, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [fetchMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isLoading && !isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading, isCollapsed])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/social-pads/${padId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      })

      if (response.ok) {
        const { message } = await response.json()
        setMessages((prev) => [...prev, message])
        setNewMessage("")
      }
    } catch (error) {
      console.error("[PadChat] Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const getDisplayName = (msg: PadMessage) => {
    if (!msg.user) return "User"
    return msg.user.full_name || msg.user.email?.split("@")[0] || "User"
  }

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase()
  }

  const formatMessageTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return ""
    }
  }

  if (isCollapsed) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-purple-200 cursor-pointer hover:shadow-2xl transition-shadow"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <MessageSquare className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-gray-900">Pad Chat</span>
          {messages.length > 0 && (
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
          <ChevronUp className="h-4 w-4 text-gray-500 ml-2" />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 h-96 bg-white rounded-lg shadow-xl border border-purple-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-white" />
          <span className="font-semibold text-white">Pad Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-7 w-7 p-0 text-white hover:bg-white/20"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === currentUserId
            const displayName = getDisplayName(msg)

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className={`max-w-[75%] ${isOwnMessage ? "text-right" : ""}`}>
                  <div
                    className={`inline-block rounded-lg px-3 py-2 ${
                      isOwnMessage
                        ? "bg-purple-600 text-white"
                        : "bg-white text-gray-900 border"
                    }`}
                  >
                    {!isOwnMessage && (
                      <p className="text-xs font-medium mb-1 text-purple-600">
                        {displayName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                  <p className="text-xs mt-0.5 text-gray-400">
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t bg-white rounded-b-lg">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="resize-none min-h-[40px] max-h-[80px] text-sm"
            maxLength={500}
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
            size="sm"
            className="self-end h-10 w-10 p-0 bg-purple-600 hover:bg-purple-700"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

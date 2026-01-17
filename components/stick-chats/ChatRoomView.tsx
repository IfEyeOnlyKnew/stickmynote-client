"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Send,
  FileText,
  Loader2,
  Users,
  User,
  AlertTriangle,
  UserPlus,
  Settings,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useCSRF } from "@/hooks/useCSRF"
import type {
  StickChatWithDetails,
  StickChatMessageWithUser,
  StickChatMemberWithUser,
} from "@/types/stick-chat"
import { getChatDisplayName, isChatExpiringSoon, getDaysUntilExpiry } from "@/types/stick-chat"

interface ChatRoomViewProps {
  chat: StickChatWithDetails
  currentUserId: string
  onExport?: () => void
  onInviteMembers?: () => void
  onSettings?: () => void
}

/**
 * Full chat room view with message history and input.
 * Used on the /chats/[chatId] page.
 */
export const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  chat,
  currentUserId,
  onExport,
  onInviteMembers,
  onSettings,
}) => {
  const { csrfToken } = useCSRF()
  const [messages, setMessages] = useState<StickChatMessageWithUser[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch messages
  const fetchMessages = useCallback(
    async (loadMore = false) => {
      try {
        const params = new URLSearchParams()
        if (loadMore && cursor) {
          params.set("cursor", cursor)
        }

        const response = await fetch(
          `/api/stick-chats/${chat.id}/messages?${params.toString()}`
        )
        if (response.ok) {
          const data = await response.json()
          if (loadMore) {
            setMessages((prev) => [...data.messages, ...prev])
          } else {
            setMessages(data.messages)
          }
          setHasMore(data.hasMore)
          setCursor(data.cursor)
        }
      } catch (error) {
        console.error("Error fetching messages:", error)
      } finally {
        setIsLoading(false)
      }
    },
    [chat.id, cursor]
  )

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages()

    // Poll for new messages every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages()
    }, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [chat.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/stick-chats/${chat.id}/messages`, {
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
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  // Export handler
  const handleExport = async () => {
    if (isExporting || messages.length === 0) return

    setIsExporting(true)
    try {
      const response = await fetch(`/api/stick-chats/${chat.id}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      })

      if (response.ok) {
        const { exportUrl } = await response.json()
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

  // Get display name
  const displayName = getChatDisplayName(chat, currentUserId)

  // Check expiry
  const expiringSoon = isChatExpiringSoon(chat)
  const daysUntilExpiry = getDaysUntilExpiry(chat)

  // Get user display name
  const getDisplayName = (msg: StickChatMessageWithUser) => {
    if (!msg.user) return "User"
    return msg.user.full_name || msg.user.username || msg.user.email || "User"
  }

  // Get initials
  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase()
  }

  // Format message timestamp
  const formatMessageTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return ""
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {chat.is_group ? (
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            )}
            <div>
              <h1 className="font-semibold text-lg text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-500">
                {chat.members?.length || 1} member
                {(chat.members?.length || 1) !== 1 ? "s" : ""}
                {chat.stick_topic && (
                  <span className="ml-2 text-purple-600">
                    • {chat.stick_topic}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Expiry warning */}
            {expiringSoon && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {daysUntilExpiry}d until expiry
              </Badge>
            )}

            {/* Action buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || messages.length === 0}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-1" />
              )}
              Export
            </Button>

            {chat.is_group && chat.owner_id === currentUserId && (
              <Button variant="outline" size="sm" onClick={onInviteMembers}>
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            )}

            {chat.owner_id === currentUserId && (
              <Button variant="ghost" size="sm" onClick={onSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Load more button */}
        {hasMore && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchMessages(true)}
              disabled={isLoading}
            >
              Load older messages
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm mt-1">Start the conversation below</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === currentUserId
            const displayName = getDisplayName(msg)

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-gray-200">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`max-w-[70%] ${isOwnMessage ? "text-right" : ""}`}
                >
                  <div
                    className={`inline-block rounded-lg px-4 py-2 ${
                      isOwnMessage
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {!isOwnMessage && (
                      <p
                        className={`text-xs font-medium mb-1 ${
                          isOwnMessage ? "text-blue-100" : "text-gray-600"
                        }`}
                      >
                        {displayName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      isOwnMessage ? "text-gray-400" : "text-gray-400"
                    }`}
                  >
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
      <div className="flex-shrink-0 border-t p-4 bg-gray-50">
        <div className="flex gap-3">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="resize-none min-h-[60px] max-h-[120px] bg-white"
            maxLength={2000}
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
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{newMessage.length}/2000</span>
          <span className="text-xs text-gray-400">
            Press Enter to send, Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  )
}

"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  PanelRightClose,
  PanelRightOpen,
  Video,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useCSRF } from "@/hooks/useCSRF"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useUserPresence } from "@/hooks/usePresence"
import type {
  StickChatWithDetails,
  StickChatMessageWithUser,
} from "@/types/stick-chat"
import { getChatDisplayName, isChatExpiringSoon, getDaysUntilExpiry } from "@/types/stick-chat"

interface ChatRoomViewProps {
  readonly chat: StickChatWithDetails
  readonly currentUserId: string
  readonly onExport?: () => void
  readonly onInviteMembers?: () => void
  readonly onSettings?: () => void
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
  const { subscribe } = useWebSocket()
  const [messages, setMessages] = useState<StickChatMessageWithUser[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [showMembersPanel, setShowMembersPanel] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Get member IDs for presence tracking
  const memberIds = useMemo(() => {
    return chat.members?.map((m) => m.user_id) || []
  }, [chat.members])

  // Track presence for all members
  const { presence } = useUserPresence(memberIds)

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

  // Extracted handlers to reduce function nesting depth
  const handleWsMessageEdited = useCallback((payload: any) => {
    if (payload.chatId !== chat.id) return
    setMessages((prev) =>
      prev.map((m) => (m.id === payload.message.id ? payload.message : m))
    )
  }, [chat.id])

  const handleWsNewMessage = useCallback((payload: any) => {
    if (payload.chatId !== chat.id) return
    setMessages((prev) => [...prev, payload.message])
  }, [chat.id])

  // Initial fetch + WebSocket for real-time updates
  useEffect(() => {
    fetchMessages()

    const unsubMessage = subscribe("chat.message", handleWsNewMessage)
    const unsubEdit = subscribe("chat.message_edited", handleWsMessageEdited)

    return () => {
      unsubMessage()
      unsubEdit()
    }
  }, [chat.id, handleWsNewMessage, handleWsMessageEdited]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Count online members
  const onlineCount = useMemo(() => {
    return memberIds.filter((id) => presence[id]?.isOnline).length
  }, [memberIds, presence])

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
                {(chat.members?.length || 1) === 1 ? "" : "s"}
                {onlineCount > 0 && (
                  <span className="ml-2 text-green-600">
                    • {onlineCount} online
                  </span>
                )}
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
              onClick={() => window.open("/video", "_blank")}
              title="Start video call"
            >
              <Video className="w-4 h-4 mr-1" />
              Video
            </Button>

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

            {chat.owner_id === currentUserId && (
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

            {/* Toggle members panel */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMembersPanel(!showMembersPanel)}
              title={showMembersPanel ? "Hide members" : "Show members"}
            >
              {showMembersPanel ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area with messages and optional members panel */}
      <div className="flex flex-1 overflow-hidden">
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

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm mt-1">Start the conversation below</p>
          </div>
        )}
        {!isLoading && messages.length > 0 && (
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
                        className="text-xs font-medium mb-1 text-gray-600"
                      >
                        {displayName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                  <p
                    className="text-xs mt-1 text-gray-400"
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

        {/* Members panel */}
        {showMembersPanel && chat.members && chat.members.length > 0 && (
          <div className="w-64 border-l bg-gray-50 flex-shrink-0 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Members ({chat.members.length})
              </h3>
              <div className="space-y-2">
                {chat.members.map((member) => {
                  const isOnline = presence[member.user_id]?.isOnline
                  const memberName =
                    member.user?.full_name ||
                    member.user?.username ||
                    member.user?.email ||
                    "User"
                  const isOwner = member.user_id === chat.owner_id

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
                    >
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-gray-200">
                            {memberName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online indicator */}
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-50 ${
                            isOnline ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {memberName}
                          {member.user_id === currentUserId && (
                            <span className="text-gray-400 ml-1">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {isOwner && <span className="text-purple-600">Owner • </span>}
                          {isOnline ? (
                            <span className="text-green-600">Online</span>
                          ) : (
                            <span>Offline</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
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

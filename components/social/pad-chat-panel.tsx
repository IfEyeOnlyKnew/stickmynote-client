"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Send,
  Loader2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Settings,
  Pin,
  Trash2,
  MoreHorizontal,
  Shield,
  Smile,
  Clock,
  Bot,
  AlertCircle,
  Bell,
  BellOff,
  Users,
  List,
  Lock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { PadChatSettingsDialog } from "./pad-chat-settings"
import type { PadChatSettings, ReactionEmoji } from "@/types/pad-chat"
import { AVAILABLE_REACTIONS, isWithinOfficeHours } from "@/types/pad-chat"
import { useChatNotifications } from "@/hooks/useBrowserNotifications"

interface PadMessage {
  id: string
  social_pad_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string
  is_pinned?: boolean
  pinned_by?: string | null
  pinned_at?: string | null
  is_edited?: boolean
  edited_at?: string | null
  is_deleted?: boolean
  deleted_by?: string | null
  reply_to_id?: string | null
  is_ai_message?: boolean
  is_system_message?: boolean
  user?: {
    id: string
    full_name: string | null
    email: string
    avatar_url?: string | null
    is_moderator?: boolean
  }
  reactions?: Array<{
    emoji: string
    count: number
    users: string[]
    user_reacted: boolean
  }>
}

interface PadChatPanelProps {
  padId: string
  padName: string
  currentUserId: string
  isOwner: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
}

export function PadChatPanel({
  padId,
  padName,
  currentUserId,
  isOwner,
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}: PadChatPanelProps) {
  const [messages, setMessages] = useState<PadMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [settings, setSettings] = useState<PadChatSettings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moderatorIds, setModeratorIds] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showReactions, setShowReactions] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [viewMode, setViewMode] = useState<"chronological" | "grouped">("chronological")
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [unreadPerUser, setUnreadPerUser] = useState<Map<string, number>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageCountRef = useRef(0)
  const lastMessageIdRef = useRef<string | null>(null)
  const shouldScrollRef = useRef(true) // Track if we should auto-scroll on next message update

  // Check if current user is a moderator
  const isModerator = useMemo(() => {
    return isOwner || moderatorIds.has(currentUserId)
  }, [isOwner, moderatorIds, currentUserId])

  // Browser notifications
  const {
    notificationsEnabled,
    enableNotifications,
    disableNotifications,
    notifyNewMessage,
    isSupported: notificationsSupported,
  } = useChatNotifications(padId, padName, isModerator)

  // Check if within office hours
  const isOfficeHours = useMemo(() => {
    if (!settings) return true
    return isWithinOfficeHours(settings)
  }, [settings])

  // Fetch messages - optimized with cursor-based polling
  // Initial fetch gets all messages, subsequent polls only get new ones
  const fetchMessages = useCallback(async (isInitialFetch = false) => {
    try {
      // Use cursor for incremental fetches (reduces data transfer by ~99% on polls)
      const cursor = !isInitialFetch && lastMessageIdRef.current
        ? `?after=${lastMessageIdRef.current}`
        : ""
      const response = await fetch(`/api/social-pads/${padId}/messages${cursor}`)

      if (response.ok) {
        const data = await response.json()
        const fetchedMessages: PadMessage[] = data.messages || []

        if (fetchedMessages.length > 0) {
          // Handle new messages from poll
          if (!isInitialFetch && lastMessageIdRef.current) {
            // Incremental update - append new messages
            setMessages(prev => {
              // Deduplicate just in case
              const existingIds = new Set(prev.map(m => m.id))
              const newOnes = fetchedMessages.filter(m => !existingIds.has(m.id))
              return newOnes.length > 0 ? [...prev, ...newOnes] : prev
            })

            // Notify for each new message from others
            for (const msg of fetchedMessages) {
              if (msg.user_id !== currentUserId) {
                // Track unread
                if (isCollapsed) {
                  setUnreadCount(prev => prev + 1)
                }

                // Track unread per user for grouped view
                if (viewMode === "grouped" && !expandedUsers.has(msg.user_id)) {
                  setUnreadPerUser(prev => {
                    const newMap = new Map(prev)
                    newMap.set(msg.user_id, (newMap.get(msg.user_id) || 0) + 1)
                    return newMap
                  })
                }

                // Play sound if enabled (once for batch)
                if (settings?.enable_sounds && msg === fetchedMessages[fetchedMessages.length - 1]) {
                  playNotificationSound()
                }

                // Browser notification for moderators
                if (msg.user) {
                  const senderName = msg.user.full_name ||
                    msg.user.email?.split("@")[0] || "Someone"
                  notifyNewMessage(senderName, msg.content)
                }
              }
            }
          } else {
            // Initial fetch - replace all
            setMessages(fetchedMessages)
          }

          // Update cursor to latest message
          const latestMessage = fetchedMessages[fetchedMessages.length - 1]
          lastMessageIdRef.current = latestMessage.id
          lastMessageCountRef.current = fetchedMessages.length
        }
      }
    } catch (error) {
      console.error("[PadChat] Error fetching messages:", error)
    } finally {
      setIsLoading(false)
    }
  }, [padId, isCollapsed, settings?.enable_sounds, currentUserId, notifyNewMessage, viewMode, expandedUsers])

  // Fetch settings and moderators
  const fetchSettingsAndModerators = useCallback(async () => {
    try {
      const [settingsRes, moderatorsRes] = await Promise.all([
        fetch(`/api/social-pads/${padId}/chat-settings`),
        fetch(`/api/social-pads/${padId}/chat-moderators`),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data.settings)
      }

      if (moderatorsRes.ok) {
        const data = await moderatorsRes.json()
        const modIds = new Set<string>(data.moderators?.map((m: any) => m.user_id) || [])
        setModeratorIds(modIds)
      }
    } catch (error) {
      console.error("[PadChat] Error fetching settings:", error)
    }
  }, [padId])

  // Initial fetch and polling
  useEffect(() => {
    shouldScrollRef.current = true // Scroll to bottom on initial load
    fetchMessages(true) // Initial fetch - get all messages
    fetchSettingsAndModerators()

    // Poll for new messages every 3 seconds (cursor-based - only fetches new messages)
    pollingIntervalRef.current = setInterval(() => fetchMessages(false), 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [fetchMessages, fetchSettingsAndModerators])

  // Handle scroll position tracking
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const nearBottom = distanceFromBottom < 100 // Within 100px of bottom

    setIsNearBottom(nearBottom)
    if (nearBottom) {
      setHasNewMessages(false)
      setUnreadCount(0)
    }
  }, [])

  // Auto-scroll to bottom on new messages (only if user is near bottom or just sent a message)
  useEffect(() => {
    if (!isLoading && !isCollapsed && messages.length > 0) {
      if (shouldScrollRef.current || isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        setUnreadCount(0)
        setHasNewMessages(false)
        shouldScrollRef.current = false
      } else {
        // User is scrolled up, show indicator
        setHasNewMessages(true)
      }
    }
  }, [messages, isLoading, isCollapsed, isNearBottom])

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setHasNewMessages(false)
    setUnreadCount(0)
  }, [])

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio("/sounds/notification.mp3")
      audio.volume = 0.3
      audio.play().catch(() => {})
    } catch {
      // Silent fail
    }
  }

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    // Check if chat is enabled
    if (settings && !settings.chat_enabled) {
      toast.error("Chat is currently disabled")
      return
    }

    // Save message content and clear input immediately for better UX
    const messageContent = newMessage.trim()
    setNewMessage("")
    setIsSending(true)
    shouldScrollRef.current = true // Scroll to bottom when user sends their own message

    try {
      const response = await fetch(`/api/social-pads/${padId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent }),
      })

      if (response.ok) {
        const { message, aiMessage } = await response.json()
        // Add user message
        setMessages((prev) => [...prev, message])
        // Add AI response if generated
        if (aiMessage) {
          setMessages((prev) => [...prev, aiMessage])
        }
        // Clear typing status
        sendTypingStatus(false)
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to send message")
        // Restore message on error so user can retry
        setNewMessage(messageContent)
      }
    } catch (error) {
      console.error("[PadChat] Error sending message:", error)
      toast.error("Failed to send message")
      // Restore message on error so user can retry
      setNewMessage(messageContent)
    } finally {
      setIsSending(false)
    }
  }

  // Send typing indicator
  const sendTypingStatus = useCallback(async (typing: boolean) => {
    try {
      await fetch(`/api/social-pads/${padId}/chat-typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing }),
      })
    } catch {
      // Silent fail
    }
  }, [padId])

  // Fetch typing users
  const fetchTypingUsers = useCallback(async () => {
    try {
      const response = await fetch(`/api/social-pads/${padId}/chat-typing`)
      if (response.ok) {
        const data = await response.json()
        setTypingUsers(data.typing?.map((t: { name: string }) => t.name) || [])
      }
    } catch {
      // Silent fail
    }
  }, [padId])

  // Poll for typing users
  useEffect(() => {
    if (isCollapsed) return

    const typingPollingInterval = setInterval(fetchTypingUsers, 2000)
    return () => clearInterval(typingPollingInterval)
  }, [fetchTypingUsers, isCollapsed])

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Send typing start
    sendTypingStatus(true)

    // Clear typing status after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false)
    }, 3000)
  }

  // Clear typing status when message is sent or component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      // Don't send on unmount to avoid errors
    }
  }, [])

  // Pin message
  const handlePinMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/social-pads/${padId}/messages/${messageId}/pin`, {
        method: "POST",
      })
      if (response.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_pinned: true } : m))
        )
        toast.success("Message pinned")
      }
    } catch {
      toast.error("Failed to pin message")
    }
  }

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return

    try {
      const response = await fetch(`/api/social-pads/${padId}/messages/${messageId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        toast.success("Message deleted")
      }
    } catch {
      toast.error("Failed to delete message")
    }
  }

  // Toggle reaction
  const handleToggleReaction = async (messageId: string, emoji: ReactionEmoji) => {
    try {
      await fetch(`/api/social-pads/${padId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      })
      // Refresh messages to get updated reactions (full fetch needed)
      fetchMessages(true)
    } catch {
      // Silent fail
    }
    setShowReactions(null)
  }

  const getDisplayName = (msg: PadMessage) => {
    if (!msg.user) return "User"
    return msg.user.full_name || msg.user.email?.split("@")[0] || "User"
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const formatMessageTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return ""
    }
  }

  const isUserModerator = (userId: string) => moderatorIds.has(userId)
  const canModerate = isOwner || isUserModerator(currentUserId)

  // Pinned messages
  const pinnedMessages = useMemo(() => messages.filter((m) => m.is_pinned), [messages])

  // Grouped messages by user (for moderator view)
  interface GroupedUser {
    userId: string
    user: PadMessage["user"]
    messages: PadMessage[]
    lastMessageTime: string
    unreadCount: number
  }

  const groupedMessages = useMemo((): GroupedUser[] => {
    const groups = new Map<string, GroupedUser>()
    const visibleMessages = messages.filter(m => !m.is_deleted && !m.is_ai_message && !m.is_system_message)

    for (const msg of visibleMessages) {
      const userId = msg.user_id
      if (!groups.has(userId)) {
        groups.set(userId, {
          userId,
          user: msg.user,
          messages: [],
          lastMessageTime: msg.created_at,
          unreadCount: unreadPerUser.get(userId) || 0,
        })
      }
      const group = groups.get(userId)!
      group.messages.push(msg)
      // Update last message time if newer
      if (new Date(msg.created_at) > new Date(group.lastMessageTime)) {
        group.lastMessageTime = msg.created_at
      }
    }

    // Sort by last message time (most recent first)
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    )
  }, [messages, unreadPerUser])

  // Toggle user expansion in grouped view
  const toggleUserExpanded = useCallback((userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
        // Clear unread count for this user when expanded
        setUnreadPerUser(prevUnread => {
          const newMap = new Map(prevUnread)
          newMap.delete(userId)
          return newMap
        })
      }
      return next
    })
  }, [])

  if (isCollapsed) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-purple-200 cursor-pointer hover:shadow-2xl transition-all hover:scale-105"
        onClick={() => {
          onToggleCollapse?.()
          setUnreadCount(0)
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <MessageSquare className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-gray-900">Pad Chat</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
          <ChevronUp className="h-4 w-4 text-gray-500 ml-2" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-purple-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-lg">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-white" />
            <span className="font-semibold text-white">Pad Chat</span>
            {settings?.ai_enabled && (
              <Badge className="bg-white/20 text-white text-xs">
                <Bot className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* View mode toggle for moderators */}
            {isModerator && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode(viewMode === "chronological" ? "grouped" : "chronological")}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20"
                    >
                      {viewMode === "chronological" ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        <List className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{viewMode === "chronological" ? "Group by user" : "Chronological view"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Notification toggle for moderators */}
            {notificationsSupported && isModerator && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => notificationsEnabled ? disableNotifications() : enableNotifications()}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20"
                    >
                      {notificationsEnabled ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4 opacity-70" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{notificationsEnabled ? "Notifications on" : "Enable notifications"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {(isOwner || canModerate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
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

        {/* Office hours warning */}
        {settings?.office_hours_enabled && !isOfficeHours && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {settings.away_message || "Our team is currently offline."}
          </div>
        )}

        {/* Private conversations indicator */}
        {settings?.private_conversations && !isModerator && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 flex items-center gap-2">
            <Lock className="h-3 w-3" />
            Private chat - only you and moderators can see your messages
          </div>
        )}

        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-1 text-xs text-amber-700 mb-1">
              <Pin className="h-3 w-3" />
              <span className="font-medium">Pinned</span>
            </div>
            {pinnedMessages.slice(0, 2).map((msg) => (
              <p key={msg.id} className="text-xs text-amber-800 truncate">
                {msg.content}
              </p>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 relative"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : !settings?.chat_enabled ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
              <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Chat is disabled</p>
              <p className="text-xs">Contact the pad owner to enable chat</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : viewMode === "grouped" && isModerator ? (
            /* Grouped view for moderators */
            <div className="space-y-2">
              {groupedMessages.map((group) => {
                const isExpanded = expandedUsers.has(group.userId)
                const displayName = group.user?.full_name || group.user?.email?.split("@")[0] || "User"
                const userIsModerator = isUserModerator(group.userId)

                return (
                  <div key={group.userId} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    {/* User header - clickable to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => toggleUserExpanded(group.userId)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          {group.user?.avatar_url && <AvatarImage src={group.user.avatar_url} />}
                          <AvatarFallback className={`text-sm ${userIsModerator ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"}`}>
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        {userIsModerator && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5">
                            <Shield className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{displayName}</span>
                          {userIsModerator && (
                            <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 border-0">MOD</Badge>
                          )}
                          {group.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">
                              {group.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {group.messages.length} message{group.messages.length !== 1 ? "s" : ""} · Last {formatMessageTime(group.lastMessageTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded messages */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-3 space-y-2 max-h-60 overflow-y-auto">
                        {group.messages.map((msg) => (
                          <div key={msg.id} className="flex gap-2 group">
                            <div className="flex-1 bg-white rounded-lg px-3 py-2 border">
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatMessageTime(msg.created_at)}</p>
                            </div>
                            {canModerate && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                {!msg.is_pinned && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePinMessage(msg.id)}
                                    className="h-6 w-6 p-0 text-gray-400 hover:text-amber-600"
                                  >
                                    <Pin className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Chronological view (default) */
            messages.filter(m => !m.is_deleted).map((msg) => {
              const isOwnMessage = msg.user_id === currentUserId
              const displayName = getDisplayName(msg)
              const userIsModerator = isUserModerator(msg.user_id)
              const canManageMessage = isOwnMessage || canModerate

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 group ${isOwnMessage ? "flex-row-reverse" : ""}`}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            {msg.user?.avatar_url && (
                              <AvatarImage src={msg.user.avatar_url} />
                            )}
                            <AvatarFallback
                              className={`text-xs ${
                                userIsModerator
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          {userIsModerator && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5">
                              <Shield className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{displayName}</p>
                        {userIsModerator && <p className="text-xs text-amber-600">Moderator</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className={`max-w-[75%] ${isOwnMessage ? "text-right" : ""}`}>
                    <div
                      className={`relative inline-block rounded-lg px-3 py-2 ${
                        msg.is_ai_message
                          ? "bg-gradient-to-r from-purple-100 to-blue-100 text-gray-900 border border-purple-200"
                          : isOwnMessage
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-900 border"
                      }`}
                    >
                      {/* AI badge */}
                      {msg.is_ai_message && (
                        <div className="flex items-center gap-1 text-xs text-purple-600 mb-1">
                          <Bot className="h-3 w-3" />
                          <span>AI Assistant</span>
                        </div>
                      )}

                      {/* User name and moderator badge */}
                      {!isOwnMessage && !msg.is_ai_message && (
                        <div className="flex items-center gap-1 mb-1">
                          <p className="text-xs font-medium text-purple-600">
                            {displayName}
                          </p>
                          {userIsModerator && (
                            <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 border-0">
                              MOD
                            </Badge>
                          )}
                        </div>
                      )}

                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>

                      {/* Edited indicator */}
                      {msg.is_edited && (
                        <span className={`text-[10px] ${isOwnMessage ? "text-white/70" : "text-gray-400"}`}>
                          (edited)
                        </span>
                      )}

                      {/* Message actions */}
                      {canManageMessage && (
                        <div className={`absolute top-1 ${isOwnMessage ? "left-1" : "right-1"} opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-5 w-5 p-0 ${isOwnMessage ? "text-white/70 hover:text-white hover:bg-white/20" : "text-gray-400 hover:text-gray-600"}`}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isOwnMessage ? "start" : "end"}>
                              {canModerate && !msg.is_pinned && (
                                <DropdownMenuItem onClick={() => handlePinMessage(msg.id)}>
                                  <Pin className="h-3 w-3 mr-2" />
                                  Pin message
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex gap-1 mt-1 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        {msg.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, reaction.emoji as ReactionEmoji)}
                            className={`text-xs px-1.5 py-0.5 rounded-full border ${
                              reaction.user_reacted
                                ? "bg-purple-100 border-purple-300"
                                : "bg-gray-100 border-gray-200"
                            }`}
                          >
                            {reaction.emoji} {reaction.count}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timestamp and reaction button */}
                    <div className={`flex items-center gap-2 mt-0.5 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                      <p className="text-xs text-gray-400">
                        {formatMessageTime(msg.created_at)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                        className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Add reaction"
                      >
                        <Smile className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Reaction picker */}
                    {showReactions === msg.id && (
                      <div className={`flex gap-1 mt-1 p-1 bg-white rounded-lg shadow-lg border ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        {AVAILABLE_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className="text-sm hover:scale-125 transition-transform p-1"
                            aria-label={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span>{typingUsers.join(", ")} typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />

          {/* Scroll to bottom button */}
          {hasNewMessages && !isNearBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-1 z-10"
            >
              <ChevronDown className="h-3 w-3" />
              New messages
            </button>
          )}
        </div>

        {/* Input area */}
        <div className="p-3 border-t bg-white rounded-b-lg">
          {settings?.chat_enabled !== false ? (
            <>
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    handleTyping()
                  }}
                  placeholder={settings?.ai_enabled ? "Ask a question..." : "Type a message..."}
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
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{newMessage.length}/500</span>
                {settings?.ai_enabled && (
                  <span className="text-xs text-purple-500">AI will respond first</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 text-center py-2">
              Chat is currently disabled
            </p>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <PadChatSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        padId={padId}
        padName={padName}
        isOwner={isOwner}
        currentUserId={currentUserId}
      />
    </>
  )
}

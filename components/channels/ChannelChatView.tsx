"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Loader2,
  Hash,
  Volume2,
  Lock,
  Pin,
  Smile,
  Reply,
  Pencil,
  MessageSquare,
  CornerDownRight,
  X,
  PanelRightClose,
  PanelRightOpen,
  UserPlus,
  Settings,
  Video,
  Check,
  AlertTriangle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useCSRF } from "@/hooks/useCSRF"
import { useWebSocket } from "@/hooks/useWebSocket"
import { useUserPresence } from "@/hooks/usePresence"
import type {
  StickChatWithDetails,
  StickChatMessageWithUser,
  StickChatMemberWithUser,
} from "@/types/stick-chat"
import { getChatDisplayName, isChatExpiringSoon, getDaysUntilExpiry, isChannel } from "@/types/stick-chat"

interface ChannelChatViewProps {
  chat: StickChatWithDetails
  currentUserId: string
  onExport?: () => void
  onInviteMembers?: () => void
  onSettings?: () => void
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🎉", "🔥", "👀", "✅"]

function addReactionEntry(reactions: any[], emoji: string, userId?: string, userName?: string): void {
  const existing = reactions.find((r) => r.emoji === emoji)
  if (existing) {
    existing.count++
    if (userId) existing.users.push({ id: userId, full_name: userName || "" })
    else existing.hasReacted = true
  } else {
    reactions.push(
      userId
        ? { emoji, count: 1, users: [{ id: userId, full_name: userName || "" }], hasReacted: false }
        : { emoji, count: 1, users: [], hasReacted: true }
    )
  }
}

function removeReactionEntry(reactions: any[], emoji: string, userId?: string): void {
  const existing = reactions.find((r) => r.emoji === emoji)
  if (!existing) return
  existing.count--
  if (userId) existing.users = existing.users.filter((u: any) => u.id !== userId)
  else existing.hasReacted = false
  if (existing.count <= 0) reactions.splice(reactions.indexOf(existing), 1)
}

function applyReaction(reactions: any[], emoji: string, added: boolean, userId?: string, userName?: string): any[] {
  if (added) addReactionEntry(reactions, emoji, userId, userName)
  else removeReactionEntry(reactions, emoji, userId)
  return reactions
}

export function ChannelChatView({
  chat,
  currentUserId,
  onExport,
  onInviteMembers,
  onSettings,
}: Readonly<ChannelChatViewProps>) {
  const { csrfToken } = useCSRF()
  const { subscribe } = useWebSocket()

  const [messages, setMessages] = useState<StickChatMessageWithUser[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [showMembersPanel, setShowMembersPanel] = useState(false)

  // Threading
  const [threadParentId, setThreadParentId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<StickChatMessageWithUser[]>([])
  const [showThread, setShowThread] = useState(false)

  // Editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  // Quote reply
  const [quotedMessage, setQuotedMessage] = useState<StickChatMessageWithUser | null>(null)

  // Typing
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timeout: NodeJS.Timeout }>>(new Map())
  const lastTypingSentRef = useRef<number>(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const memberIds = useMemo(() => chat.members?.map((m) => m.user_id) || [], [chat.members])
  const { presence } = useUserPresence(memberIds)

  // =========== FETCH MESSAGES ===========

  const fetchMessages = useCallback(
    async (loadMore = false) => {
      try {
        const params = new URLSearchParams()
        if (loadMore && cursor) params.set("cursor", cursor)

        const res = await fetch(`/api/stick-chats/${chat.id}/messages?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
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

  useEffect(() => {
    setIsLoading(true)
    setMessages([])
    setCursor(undefined)
    fetchMessages()
  }, [chat.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // =========== WEBSOCKET SUBSCRIPTIONS ===========

  // Extracted handlers to reduce function nesting depth
  const handleWsThreadReply = useCallback((payload: any) => {
    if (payload.chatId !== chat.id) return
    setMessages((prev) =>
      prev.map((m) =>
        m.id === payload.message.parent_message_id
          ? { ...m, thread_reply_count: (m.thread_reply_count || 0) + 1, thread_last_reply_at: payload.message.created_at }
          : m
      )
    )
    if (threadParentId === payload.message.parent_message_id) {
      setThreadMessages((prev) => [...prev, payload.message])
    }
  }, [chat.id, threadParentId])

  const handleWsMessageEdited = useCallback((payload: any) => {
    if (payload.chatId !== chat.id) return
    setMessages((prev) =>
      prev.map((m) => (m.id === payload.message.id ? { ...payload.message, reactions: m.reactions } : m))
    )
  }, [chat.id])

  const applyReactionToMessages = useCallback((messageId: string, emoji: string, added: boolean, userId?: string, userName?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        return { ...m, reactions: applyReaction([...(m.reactions || [])], emoji, added, userId, userName) }
      })
    )
  }, [])

  const clearTypingUser = useCallback((userId: string) => {
    setTypingUsers((p) => {
      const n = new Map(p)
      n.delete(userId)
      return n
    })
  }, [])

  const handleWsNewMessage = useCallback((payload: any) => {
    if (payload.chatId === chat.id) {
      setMessages((prev) => [...prev, payload.message])
    }
  }, [chat.id])

  const handleWsReaction = useCallback((payload: any) => {
    if (payload.chatId !== chat.id) return
    applyReactionToMessages(payload.messageId, payload.emoji, payload.added, payload.userId, payload.userName)
  }, [chat.id, applyReactionToMessages])

  const handleWsTyping = useCallback((payload: any) => {
    if (payload.chatId !== chat.id || payload.userId === currentUserId) return
    setTypingUsers((prev) => {
      const next = new Map(prev)
      const existing = next.get(payload.userId)
      if (existing) clearTimeout(existing.timeout)
      const timeout = setTimeout(() => clearTypingUser(payload.userId), 4000)
      next.set(payload.userId, { name: payload.userName, timeout })
      return next
    })
  }, [chat.id, currentUserId, clearTypingUser])

  useEffect(() => {
    const unsubs = [
      subscribe("chat.message", handleWsNewMessage),
      subscribe("chat.thread_reply", handleWsThreadReply),
      subscribe("chat.message_edited", handleWsMessageEdited),
      subscribe("chat.reaction", handleWsReaction),
      subscribe("chat.typing", handleWsTyping),
      subscribe("chat.pinned", () => {}),
      subscribe("chat.unpinned", () => {}),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, handleWsNewMessage, handleWsThreadReply, handleWsMessageEdited, handleWsReaction, handleWsTyping])

  // =========== AUTO SCROLL ===========

  useEffect(() => {
    if (!isLoading && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading])

  // =========== SEND MESSAGE ===========

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return
    setIsSending(true)
    try {
      const body: any = { content: newMessage.trim() }
      if (quotedMessage) body.quoted_message_id = quotedMessage.id
      if (threadParentId && showThread) body.parent_message_id = threadParentId

      const res = await fetch(`/api/stick-chats/${chat.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const { message } = await res.json()
        if (message.parent_message_id && showThread) {
          setThreadMessages((prev) => [...prev, message])
          // Update parent thread count
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.parent_message_id
                ? { ...m, thread_reply_count: (m.thread_reply_count || 0) + 1 }
                : m
            )
          )
        } else {
          setMessages((prev) => [...prev, message])
        }
        setNewMessage("")
        setQuotedMessage(null)
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  // =========== EDIT MESSAGE ===========

  const startEditing = (msg: StickChatMessageWithUser) => {
    setEditingMessageId(msg.id)
    setEditContent(msg.content)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditContent("")
  }

  const saveEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return
    try {
      const res = await fetch(`/api/stick-chats/${chat.id}/messages`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ messageId: editingMessageId, content: editContent.trim() }),
      })
      if (res.ok) {
        const { message } = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...message, reactions: m.reactions } : m)))
        cancelEditing()
      }
    } catch (error) {
      console.error("Error editing message:", error)
    }
  }

  // =========== REACTIONS ===========

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/stick-chats/${chat.id}/reactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ messageId, emoji }),
      })
      if (res.ok) {
        const { added } = await res.json()
        applyReactionToMessages(messageId, emoji, added)
      }
    } catch (error) {
      console.error("Error toggling reaction:", error)
    }
  }

  // =========== TYPING INDICATOR ===========

  const sendTypingIndicator = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 3000) return
    lastTypingSentRef.current = now

    fetch(`/api/stick-chats/${chat.id}/typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    }).catch(() => {})
  }, [chat.id, csrfToken])

  // =========== THREAD ===========

  const openThread = async (messageId: string) => {
    setThreadParentId(messageId)
    setShowThread(true)
    try {
      const res = await fetch(`/api/stick-chats/${chat.id}/thread/${messageId}`)
      if (res.ok) {
        const data = await res.json()
        setThreadMessages(data.messages || [])
      }
    } catch (error) {
      console.error("Error fetching thread:", error)
    }
  }

  const closeThread = () => {
    setShowThread(false)
    setThreadParentId(null)
    setThreadMessages([])
  }

  // =========== HELPERS ===========

  const displayName = getChatDisplayName(chat, currentUserId)
  const expiringSoon = isChatExpiringSoon(chat)
  const daysUntilExpiry = getDaysUntilExpiry(chat)
  const isPersistentChannel = isChannel(chat)
  const onlineCount = useMemo(() => memberIds.filter((id) => presence[id]?.isOnline).length, [memberIds, presence])

  const getDisplayName = (msg: StickChatMessageWithUser) =>
    msg.user?.full_name || msg.user?.username || msg.user?.email || "User"

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase()

  const formatTime = (dateStr: string) => {
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) }
    catch { return "" }
  }

  const typingText = useMemo(() => {
    const names = Array.from(typingUsers.values()).map((u) => u.name)
    if (names.length === 0) return null
    if (names.length === 1) return `${names[0]} is typing...`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
    return `${names[0]} and ${names.length - 1} others are typing...`
  }, [typingUsers])

  // =========== RENDER MESSAGE ===========

  const renderMessage = (msg: StickChatMessageWithUser, isThreadView = false) => {
    const isOwnMessage = msg.user_id === currentUserId
    const isEditing = editingMessageId === msg.id

    return (
      <div
        key={msg.id}
        className="group relative px-4 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
              {getInitials(getDisplayName(msg))}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm text-gray-900">
                {getDisplayName(msg)}
              </span>
              <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
              {msg.is_edited && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>

            {/* Quoted message */}
            {msg.quoted_message && (
              <div className="mt-1 pl-3 border-l-2 border-indigo-300 bg-indigo-50/50 rounded-r py-1 px-2">
                <p className="text-xs text-indigo-600 font-medium">
                  {msg.quoted_message.user?.full_name || msg.quoted_message.user?.username || "User"}
                </p>
                <p className="text-xs text-gray-600 truncate">{msg.quoted_message.content}</p>
              </div>
            )}

            {/* Message content or edit form */}
            {isEditing ? (
              <div className="mt-1">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-sm min-h-[40px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit() }
                    if (e.key === "Escape") cancelEditing()
                  }}
                />
                <div className="flex gap-1 mt-1">
                  <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-6 text-xs">Cancel</Button>
                  <Button size="sm" onClick={saveEdit} className="h-6 text-xs">
                    <Check className="w-3 h-3 mr-1" />Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">
                {msg.content}
              </p>
            )}

            {/* Reactions */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {msg.reactions.map((r) => (
                  <button
                    type="button"
                    key={r.emoji}
                    onClick={() => toggleReaction(msg.id, r.emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                      r.hasReacted
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {r.emoji} {r.count}
                  </button>
                ))}
              </div>
            )}

            {/* Thread indicator */}
            {!isThreadView && msg.thread_reply_count > 0 && (
              <button
                type="button"
                onClick={() => openThread(msg.id)}
                className="flex items-center gap-1 mt-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                <MessageSquare className="w-3 h-3" />
                {msg.thread_reply_count} {msg.thread_reply_count === 1 ? "reply" : "replies"}
                {msg.thread_last_reply_at && (
                  <span className="text-gray-400 ml-1">
                    Last reply {formatTime(msg.thread_last_reply_at)}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Hover actions */}
          {!isEditing && (
            <div className="absolute right-4 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white border rounded-md shadow-sm -mt-2 z-10">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="React">
                    <Smile className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top">
                  <div className="flex gap-1">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className="text-lg hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {!isThreadView && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openThread(msg.id)}
                  title="Reply in thread"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setQuotedMessage(msg)}
                title="Quote reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </Button>

              {isOwnMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEditing(msg)}
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // =========== MAIN RENDER ===========

  return (
    <div className="flex h-full bg-white">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {chat.chat_type === "voice" && (
                <Volume2 className="w-5 h-5 text-green-600" />
              )}
              {chat.chat_type !== "voice" && chat.visibility === "private" && (
                <Lock className="w-5 h-5 text-gray-500" />
              )}
              {chat.chat_type !== "voice" && chat.visibility !== "private" && (
                <Hash className="w-5 h-5 text-gray-500" />
              )}
              <div>
                <h1 className="font-semibold text-lg text-gray-900">{displayName}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {chat.topic && <span>{chat.topic}</span>}
                  {!chat.topic && chat.description && (
                    <span className="truncate max-w-[300px]">{chat.description}</span>
                  )}
                  {chat.members && (
                    <span>
                      {chat.member_count || chat.members.length} members
                      {onlineCount > 0 && (
                        <span className="text-green-600 ml-1">({onlineCount} online)</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {expiringSoon && !isPersistentChannel && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {daysUntilExpiry}d
                </Badge>
              )}

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open("/video", "_blank")} title="Video call">
                <Video className="w-4 h-4" />
              </Button>

              <Button variant="ghost" size="icon" className="h-8 w-8" title="Pinned messages">
                <Pin className="w-4 h-4" />
              </Button>

              {onInviteMembers && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onInviteMembers} title="Invite">
                  <UserPlus className="w-4 h-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowMembersPanel(!showMembersPanel)}
                title={showMembersPanel ? "Hide members" : "Show members"}
              >
                {showMembersPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </Button>

              {onSettings && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSettings}>
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
          {hasMore && (
            <div className="text-center py-2">
              <Button variant="ghost" size="sm" onClick={() => fetchMessages(true)}>
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
              <Hash className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">
                {isPersistentChannel ? `Welcome to #${chat.name}` : "No messages yet"}
              </p>
              <p className="text-sm mt-1">
                {isPersistentChannel
                  ? "This is the start of the channel. Say hello!"
                  : "Start the conversation below"}
              </p>
            </div>
          )}
          {!isLoading && messages.length > 0 && (
            <div className="py-2">
              {messages.filter((m) => !m.parent_message_id).map((msg) => renderMessage(msg))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingText && (
          <div className="px-4 py-1 text-xs text-gray-500 italic">
            {typingText}
          </div>
        )}

        {/* Quoted message banner */}
        {quotedMessage && (
          <div className="px-4 py-2 bg-indigo-50 border-t flex items-center gap-2">
            <Reply className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-indigo-600 font-medium">
                Replying to {getDisplayName(quotedMessage)}
              </p>
              <p className="text-xs text-gray-600 truncate">{quotedMessage.content}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setQuotedMessage(null)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Input area */}
        <div className="flex-shrink-0 border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                sendTypingIndicator()
              }}
              placeholder={`Message ${isPersistentChannel ? "#" + chat.name : displayName}...`}
              className="resize-none min-h-[44px] max-h-[120px] text-sm"
              maxLength={4000}
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
              className="self-end h-[44px] w-[44px] p-0"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Thread panel */}
      {showThread && threadParentId && (
        <div className="w-96 border-l flex flex-col bg-gray-50">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Thread</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeThread}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Parent message */}
          <div className="border-b bg-white">
            {messages.find((m) => m.id === threadParentId) &&
              renderMessage(messages.find((m) => m.id === threadParentId)!, true)}
          </div>

          {/* Thread replies */}
          <ScrollArea className="flex-1">
            <div className="py-2">
              {threadMessages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">No replies yet</p>
              ) : (
                threadMessages.map((msg) => renderMessage(msg, true))
              )}
            </div>
          </ScrollArea>

          {/* Thread input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Reply in thread..."
                className="resize-none min-h-[40px] max-h-[80px] text-sm"
                maxLength={4000}
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
                className="self-end h-[40px] w-[40px] p-0"
                size="sm"
              >
                {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Members panel */}
      {showMembersPanel && chat.members && (
        <div className="w-60 border-l bg-gray-50 flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Members ({chat.members.length})
            </h3>

            {/* Online members */}
            {memberIds.some((id) => presence[id]?.isOnline) && (
              <>
                <p className="text-xs text-gray-400 font-medium mb-1 mt-3">
                  Online — {onlineCount}
                </p>
                {chat.members
                  .filter((m) => presence[m.user_id]?.isOnline)
                  .map((member) => renderMember(member, true))}
              </>
            )}

            {/* Offline members */}
            {memberIds.some((id) => !presence[id]?.isOnline) && (
              <>
                <p className="text-xs text-gray-400 font-medium mb-1 mt-3">
                  Offline — {memberIds.length - onlineCount}
                </p>
                {chat.members
                  .filter((m) => !presence[m.user_id]?.isOnline)
                  .map((member) => renderMember(member, false))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  function renderMember(member: StickChatMemberWithUser, isOnline: boolean) {
    const name = member.user?.full_name || member.user?.username || member.user?.email || "User"
    return (
      <div key={member.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-gray-100">
        <div className="relative">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-[10px] bg-gray-200">
              {name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-gray-50 ${
              isOnline ? "bg-green-500" : "bg-gray-300"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate ${isOnline ? "text-gray-900" : "text-gray-500"}`}>
            {name}
            {member.user_id === currentUserId && <span className="text-gray-400 ml-1">(you)</span>}
          </p>
          {member.role === "admin" && (
            <span className="text-[10px] text-indigo-500 font-medium">Admin</span>
          )}
        </div>
      </div>
    )
  }
}

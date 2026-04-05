"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Hash,
  Volume2,
  Plus,
  ChevronDown,
  ChevronRight,
  Lock,
  Users,
  MessageSquare,
  FolderPlus,
  Search,
} from "lucide-react"
import { useWebSocket } from "@/hooks/useWebSocket"
import type { StickChatWithDetails, ChannelCategory } from "@/types/stick-chat"

interface ChannelSidebarProps {
  orgId: string
  currentUserId: string
  onCreateChannel?: () => void
  onCreateCategory?: () => void
}

export function ChannelSidebar({ orgId, currentUserId, onCreateChannel, onCreateCategory }: Readonly<ChannelSidebarProps>) {
  const router = useRouter()
  const pathname = usePathname()
  const { connected, subscribe } = useWebSocket()

  const [channels, setChannels] = useState<StickChatWithDetails[]>([])
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels")
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error("Error fetching channels:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  // Extracted handler to reduce function nesting depth
  const handleWsChatMessage = useCallback((payload: any) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === payload.chatId
          ? { ...ch, unread_count: (ch.unread_count || 0) + 1 }
          : ch
      )
    )
  }, [])

  // Listen for real-time updates
  useEffect(() => {
    const unsubs = [
      subscribe("chat.message", handleWsChatMessage),
      subscribe("voice.joined", () => fetchChannels()),
      subscribe("voice.left", () => fetchChannels()),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, fetchChannels, handleWsChatMessage])

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const navigateToChannel = (channelId: string) => {
    router.push(`/channels/${channelId}`)
  }

  // Group channels by category
  const uncategorized = channels.filter((ch) => !ch.category_id)
  const categorized = categories.map((cat) => ({
    ...cat,
    channels: channels.filter((ch) => ch.category_id === cat.id),
  }))

  // Filter by search
  const filterChannels = (chs: StickChatWithDetails[]) => {
    if (!searchQuery) return chs
    const q = searchQuery.toLowerCase()
    return chs.filter(
      (ch) =>
        ch.name?.toLowerCase().includes(q) ||
        ch.description?.toLowerCase().includes(q) ||
        ch.topic?.toLowerCase().includes(q)
    )
  }

  const renderChannel = (channel: StickChatWithDetails) => {
    const isActive = pathname === `/channels/${channel.id}`
    const isVoice = channel.chat_type === "voice"
    const isPrivate = channel.visibility === "private"

    return (
      <button
        key={channel.id}
        onClick={() => navigateToChannel(channel.id)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group ${
          isActive
            ? "bg-indigo-100 text-indigo-900 font-medium"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {isVoice && (
          <Volume2 className="w-4 h-4 flex-shrink-0 text-green-600" />
        )}
        {!isVoice && isPrivate && (
          <Lock className="w-4 h-4 flex-shrink-0 text-gray-400" />
        )}
        {!isVoice && !isPrivate && (
          <Hash className="w-4 h-4 flex-shrink-0 text-gray-400" />
        )}

        <span className="truncate flex-1 text-left">{channel.name || "unnamed"}</span>

        {/* Voice participant count */}
        {isVoice && channel.voice_active_participants > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-green-100 text-green-700">
            <Users className="w-3 h-3 mr-0.5" />
            {channel.voice_active_participants}
          </Badge>
        )}

        {/* Unread count */}
        {!isVoice && (channel.unread_count || 0) > 0 && (
          <Badge className="h-5 px-1.5 text-xs bg-indigo-600">
            {channel.unread_count}
          </Badge>
        )}
      </button>
    )
  }

  const renderCategory = (category: ChannelCategory & { channels: StickChatWithDetails[] }) => {
    const isCollapsed = collapsedCategories.has(category.id)
    const filtered = filterChannels(category.channels)
    const totalUnread = filtered.reduce((sum, ch) => sum + (ch.unread_count || 0), 0)

    return (
      <div key={category.id} className="mb-1">
        <button
          onClick={() => toggleCategory(category.id)}
          className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 group"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span className="truncate flex-1 text-left">{category.name}</span>
          {totalUnread > 0 && (
            <Badge className="h-4 px-1 text-[10px] bg-indigo-600">{totalUnread}</Badge>
          )}
        </button>
        {!isCollapsed && (
          <div className="ml-1 space-y-0.5">
            {filtered.map(renderChannel)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r w-64">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 text-sm">Channels</h2>
          <div className="flex gap-1">
            {onCreateCategory && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreateCategory} title="New category">
                <FolderPlus className="w-4 h-4" />
              </Button>
            )}
            {onCreateChannel && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreateChannel} title="New channel">
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Connection status */}
      {!connected && (
        <div className="px-3 py-1 bg-yellow-50 text-yellow-700 text-xs border-b">
          Reconnecting...
        </div>
      )}

      {/* Channel list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Direct Messages section */}
          <button
            onClick={() => router.push("/chats")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              pathname === "/chats"
                ? "bg-indigo-100 text-indigo-900 font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span>Direct Messages</span>
          </button>

          <div className="border-t my-2" />

          {/* Categorized channels */}
          {categorized.map(renderCategory)}

          {/* Uncategorized channels */}
          {filterChannels(uncategorized).length > 0 && (
            <div className="space-y-0.5">
              {categories.length > 0 && (
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Other
                </div>
              )}
              {filterChannels(uncategorized).map(renderChannel)}
            </div>
          )}

          {!isLoading && channels.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No channels yet</p>
              {onCreateChannel && (
                <Button variant="link" size="sm" onClick={onCreateChannel} className="mt-1">
                  Create one
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

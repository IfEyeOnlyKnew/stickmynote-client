"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, MessagesSquare, Users, User, Loader2 } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { ChatCard } from "@/components/stick-chats/ChatCard"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import { useCSRF } from "@/hooks/useCSRF"
import type { StickChatWithDetails } from "@/types/stick-chat"

type TabFilter = "all" | "groups" | "direct"

export default function ChatsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { csrfToken } = useCSRF()
  const [chats, setChats] = useState<StickChatWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<TabFilter>("all")
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, userLoading, router])

  // Fetch chats
  const fetchChats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter === "groups") {
        params.set("is_group", "true")
      } else if (filter === "direct") {
        params.set("is_group", "false")
      }

      const response = await fetch(`/api/stick-chats?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setChats(data.chats || [])
      }
    } catch (error) {
      console.error("Error fetching chats:", error)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (user) {
      setIsLoading(true)
      fetchChats()
    }
  }, [user, filter, fetchChats])

  // Delete chat
  const handleDeleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/stick-chats/${chatId}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      })

      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId))
      } else {
        const error = await response.json()
        alert("Failed to delete chat: " + (error.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
      alert("Failed to delete chat")
    }
  }

  // Export chat
  const handleExportChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/stick-chats/${chatId}/export`, {
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
        alert("Failed to export chat: " + (error.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error exporting chat:", error)
      alert("Failed to export chat")
    }
  }

  // Count by type
  const groupCount = chats.filter((c) => c.is_group).length
  const directCount = chats.filter((c) => !c.is_group).length

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Chats Hub", current: true },
          ]}
        />

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <MessagesSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chats Hub</h1>
              <p className="text-sm text-gray-500">
                {chats.length} active chat{chats.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
            <UserMenu />
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TabFilter)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <MessagesSquare className="w-4 h-4" />
              All ({chats.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Groups ({groupCount})
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Direct ({directCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Chats Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessagesSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No chats yet</h2>
            <p className="text-gray-500 mb-6">
              {filter === "all"
                ? "Start a new chat or open a chat from a stick"
                : filter === "groups"
                ? "No group chats yet"
                : "No direct messages yet"}
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Start a Chat
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chats.map((chat) => (
              <ChatCard
                key={chat.id}
                chat={chat}
                currentUserId={user.id}
                onDelete={handleDeleteChat}
                onExport={handleExportChat}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Chat Modal */}
      <CreateChatModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  )
}

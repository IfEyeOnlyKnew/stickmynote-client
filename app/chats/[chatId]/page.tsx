"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUser } from "@/contexts/user-context"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { ChatRoomView } from "@/components/stick-chats/ChatRoomView"
import { ChatInviteModal } from "@/components/stick-chats/ChatInviteModal"
import type { StickChatWithDetails, StickChatMemberWithUser } from "@/types/stick-chat"
import { getChatDisplayName } from "@/types/stick-chat"

export default function ChatRoomPage() {
  const params = useParams()
  const chatId = params.chatId as string
  
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [chat, setChat] = useState<StickChatWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, userLoading, router])

  // Fetch chat details
  useEffect(() => {
    const fetchChat = async () => {
      if (!user) return

      try {
        const response = await fetch(`/api/stick-chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          setChat(data.chat)
        } else if (response.status === 404) {
          setError("Chat not found")
        } else if (response.status === 403) {
          setError("You don't have access to this chat")
        } else {
          setError("Failed to load chat")
        }
      } catch (err) {
        console.error("Error fetching chat:", err)
        setError("Failed to load chat")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChat()
  }, [chatId, user])

  if (userLoading || (isLoading && !error)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Chats Hub", href: "/chats" },
              { label: "Chat", current: true },
            ]}
          />

          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
            <p className="text-gray-500 mb-6">
              The chat you're looking for doesn't exist or you don't have access.
            </p>
            <Button onClick={() => router.push("/chats")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chats
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!chat) {
    return null
  }

  const displayName = getChatDisplayName(chat, user.id)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-4 max-w-4xl">
        <div className="mb-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Chats Hub", href: "/chats" },
              { label: displayName, current: true },
            ]}
          />
        </div>
      </div>

      {/* Chat Room */}
      <div className="flex-1 container mx-auto px-4 pb-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm border h-[calc(100vh-140px)]">
          <ChatRoomView
            chat={chat}
            currentUserId={user.id}
            onInviteMembers={() => {
              setInviteModalOpen(true)
            }}
            onSettings={() => {
              // TODO: Implement settings modal
              alert("Chat settings feature coming soon!")
            }}
          />
        </div>
      </div>

      {/* Invite Modal */}
      <ChatInviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        chatId={chatId}
        chatName={displayName}
        currentMembers={chat.members || []}
        onMembersUpdated={(members: StickChatMemberWithUser[]) => {
          setChat((prev) => prev ? { ...prev, members } : prev)
        }}
      />
    </div>
  )
}

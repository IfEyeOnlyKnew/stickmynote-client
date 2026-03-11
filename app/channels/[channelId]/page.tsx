"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { ChannelChatView } from "@/components/channels/ChannelChatView"
import { VoiceChannelView } from "@/components/channels/VoiceChannelView"
import { ChatInviteModal } from "@/components/stick-chats/ChatInviteModal"
import { Loader2 } from "lucide-react"
import type { StickChatWithDetails } from "@/types/stick-chat"

export default function ChannelPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const channelId = params.channelId as string

  const [channel, setChannel] = useState<StickChatWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth/login")
      return
    }

    if (channelId && user) {
      setIsLoading(true)
      fetch(`/api/stick-chats/${channelId}`)
        .then((r) => {
          if (!r.ok) throw new Error("Not found")
          return r.json()
        })
        .then((data) => setChannel(data.chat || data))
        .catch((err) => {
          console.error("Error fetching channel:", err)
          router.push("/channels")
        })
        .finally(() => setIsLoading(false))
    }
  }, [channelId, user, userLoading, router])

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!channel || !user) return null

  // Voice channel
  if (channel.chat_type === "voice") {
    return (
      <VoiceChannelView
        channel={channel}
        currentUserId={user.id}
      />
    )
  }

  // Text channel / chat
  return (
    <>
      <ChannelChatView
        chat={channel}
        currentUserId={user.id}
        onInviteMembers={() => setInviteModalOpen(true)}
      />
      {inviteModalOpen && (
        <ChatInviteModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          chatId={channel.id}
          chatName={channel.name || "Channel"}
          currentMembers={channel.members || []}
          onMembersUpdated={() => {
            // Refresh channel data
            fetch(`/api/stick-chats/${channel.id}`)
              .then((r) => r.json())
              .then((data) => setChannel(data.chat || data))
              .catch(() => {})
          }}
        />
      )}
    </>
  )
}

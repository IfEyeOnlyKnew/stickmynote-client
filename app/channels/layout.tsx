"use client"

import React, { useState, useCallback } from "react"
import { useUser } from "@/contexts/user-context"
import { ChannelSidebar } from "@/components/channels/ChannelSidebar"
import { CreateChannelModal } from "@/components/channels/CreateChannelModal"
import { Loader2 } from "lucide-react"

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleChannelCreated = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <ChannelSidebar
        key={refreshKey}
        orgId=""
        currentUserId={user.id}
        onCreateChannel={() => setCreateChannelOpen(true)}
        onCreateCategory={() => {
          const name = prompt("Category name:")
          if (name?.trim()) {
            fetch("/api/channels/categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim() }),
            }).then(() => setRefreshKey((k) => k + 1))
          }
        }}
      />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      <CreateChannelModal
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
        onCreated={handleChannelCreated}
      />
    </div>
  )
}

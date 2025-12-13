"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/contexts/user-context"

export type PresenceUser = {
  odence: string
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
  lastSeen: number
  viewing: string
}

interface UsePresenceOptions {
  padId?: string
  stickId?: string
}

export function usePresence({ padId, stickId }: UsePresenceOptions = {}) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const { user, profile } = useUser()

  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    const channelName = stickId ? `presence-stick-${stickId}` : padId ? `presence-pad-${padId}` : "presence-social"

    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState()
        const users: PresenceUser[] = []

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          presences.forEach((presence) => {
            users.push({
              odence: presence.odence,
              userId: presence.oduserId, // Fix typo: oduserId -> userId
              userName: presence.userName,
              userEmail: presence.userEmail,
              avatarUrl: presence.avatarUrl,
              lastSeen: presence.lastSeen,
              viewing: presence.viewing,
            })
          })
        })

        setPresenceUsers(users.filter((u) => u.userId !== user.id))
      })
      .on("presence", { event: "join" }, ({ key, newPresences }: { key: string; newPresences: PresenceUser[] }) => {
        // User joined
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }: { key: string; leftPresences: PresenceUser[] }) => {
        // User left
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true)
          await presenceChannel.track({
            userId: user.id,
            userName: profile?.full_name || user.email || "Anonymous",
            userEmail: user.email || "",
            avatarUrl: profile?.avatar_url || undefined,
            lastSeen: Date.now(),
            viewing: stickId || padId || "social-hub",
          })
        }
      })

    const presenceInterval = setInterval(async () => {
      if (isConnected) {
        await presenceChannel.track({
          userId: user.id,
          userName: profile?.full_name || user.email || "Anonymous",
          userEmail: user.email || "",
          avatarUrl: profile?.avatar_url || undefined,
          lastSeen: Date.now(),
          viewing: stickId || padId || "social-hub",
        })
      }
    }, 30000)

    return () => {
      clearInterval(presenceInterval)
      presenceChannel.unsubscribe()
      setIsConnected(false)
    }
  }, [user, profile, padId, stickId])

  return { presenceUsers, isConnected }
}

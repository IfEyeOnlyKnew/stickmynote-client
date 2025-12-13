"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

interface UseRealtimeSticksOptions {
  padId?: string
  onStickCreated?: (stick: any) => void
  onStickUpdated?: (stick: any) => void
  onStickDeleted?: (stickId: string) => void
  onReplyCreated?: (reply: any) => void
}

type SocialStickPayload = {
  id: string
  social_pad_id: string
  [key: string]: any
}

export function useRealtimeSticks({
  padId,
  onStickCreated,
  onStickUpdated,
  onStickDeleted,
  onReplyCreated,
}: UseRealtimeSticksOptions) {
  const [isConnected, setIsConnected] = useState(false)

  const callbacksRef = useRef({
    onStickCreated,
    onStickUpdated,
    onStickDeleted,
    onReplyCreated,
  })

  useEffect(() => {
    callbacksRef.current = {
      onStickCreated,
      onStickUpdated,
      onStickDeleted,
      onReplyCreated,
    }
  }, [onStickCreated, onStickUpdated, onStickDeleted, onReplyCreated])

  const isSubscribedRef = useRef(false)

  useEffect(() => {
    if (isSubscribedRef.current) {
      return
    }

    const supabase = createClient()
    const channelName = `social-sticks${padId ? `-${padId}` : ""}-${Date.now()}`

    isSubscribedRef.current = true

    const sticksChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "social_sticks",
          ...(padId && { filter: `social_pad_id=eq.${padId}` }),
        },
        (payload: RealtimePostgresChangesPayload<SocialStickPayload>) => {
          callbacksRef.current.onStickCreated?.(payload.new)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "social_sticks",
          ...(padId && { filter: `social_pad_id=eq.${padId}` }),
        },
        (payload: RealtimePostgresChangesPayload<SocialStickPayload>) => {
          callbacksRef.current.onStickUpdated?.(payload.new)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "social_sticks",
          ...(padId && { filter: `social_pad_id=eq.${padId}` }),
        },
        (payload: RealtimePostgresChangesPayload<SocialStickPayload>) => {
          const oldRecord = payload.old as SocialStickPayload | undefined
          if (oldRecord?.id) {
            callbacksRef.current.onStickDeleted?.(oldRecord.id)
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true)
        }
      })

    const repliesChannelName = `social-replies-${padId || "all"}-${Date.now()}`
    const repliesChannel = supabase
      .channel(repliesChannelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "social_stick_replies",
        },
        (payload: RealtimePostgresChangesPayload<{ id: string; [key: string]: any }>) => {
          callbacksRef.current.onReplyCreated?.(payload.new)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "social_stick_replies",
        },
        (payload: RealtimePostgresChangesPayload<{ id: string; [key: string]: any }>) => {
          callbacksRef.current.onReplyCreated?.(payload.new)
        },
      )
      .subscribe()

    return () => {
      isSubscribedRef.current = false
      sticksChannel.unsubscribe()
      repliesChannel.unsubscribe()
      setIsConnected(false)
    }
  }, [padId]) // Only depend on padId, not callbacks

  return { isConnected }
}

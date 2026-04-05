"use client"

import { useEffect, useState, useCallback } from "react"
import { RealtimeSync } from "@/lib/collaboration/realtime-sync"

interface Reply {
  id: string
  content: string
  color: string
  category: string
  created_at: string
  updated_at: string
  user_id: string
  social_stick_id: string
}

export function useRealtimeReplies(stickId: string, initialReplies: Reply[] = []) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies)
  const [, setRealtimeSync] = useState<RealtimeSync | null>(null)

  const handleInsert = useCallback(
    (payload: any) => {
      const newReply = payload.new as Reply
      if (newReply.social_stick_id === stickId) {
        setReplies((prev) => {
          // Check if reply already exists
          if (prev.some((r) => r.id === newReply.id)) {
            return prev
          }
          return [...prev, newReply]
        })
      }
    },
    [stickId],
  )

  const handleUpdate = useCallback(
    (payload: any) => {
      const updatedReply = payload.new as Reply
      if (updatedReply.social_stick_id === stickId) {
        setReplies((prev) => prev.map((reply) => (reply.id === updatedReply.id ? updatedReply : reply)))
      }
    },
    [stickId],
  )

  const handleDelete = useCallback((payload: any) => {
    const deletedReply = payload.old as Reply
    setReplies((prev) => prev.filter((reply) => reply.id !== deletedReply.id))
  }, [])

  useEffect(() => {
    const sync = new RealtimeSync(`stick:${stickId}:replies`, {
      table: "social_stick_replies",
      filter: `social_stick_id=eq.${stickId}`,
      onInsert: handleInsert,
      onUpdate: handleUpdate,
      onDelete: handleDelete,
    })

    sync.subscribe()
    setRealtimeSync(sync)

    return () => {
      sync.unsubscribe()
    }
  }, [stickId, handleInsert, handleUpdate, handleDelete])

  // Update replies when initialReplies changes
  useEffect(() => {
    setReplies(initialReplies)
  }, [initialReplies])

  return { replies, setReplies }
}

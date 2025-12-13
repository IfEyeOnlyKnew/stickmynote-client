"use client"

import { useEffect, useState, useRef } from "react"
import * as Y from "yjs"
import { SupabaseYjsProvider } from "./supabase-yjs-provider"
import { createClient } from "@/lib/supabase/client"

export interface CollaborationOptions {
  documentId: string
  enabled?: boolean
  onConnectionChange?: (connected: boolean) => void
  onUsersChange?: (users: Array<{ id: string; name: string; color: string }>) => void
}

const USER_COLORS = [
  "#FF6B6B", // red
  "#4ECDC4", // teal
  "#45B7D1", // blue
  "#FFA07A", // salmon
  "#98D8C8", // mint
  "#F7DC6F", // yellow
  "#BB8FCE", // purple
  "#85C1E2", // sky blue
]

export function useCollaboration(options: CollaborationOptions) {
  const { documentId, enabled = true, onConnectionChange, onUsersChange } = options

  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<SupabaseYjsProvider | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!enabled || !documentId) {
      return
    }

    let mounted = true
    let cleanupFn: (() => void) | undefined

    async function initCollaboration() {
      try {
        const supabase = supabaseRef.current

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) {
            setIsConnected(false)
            setError(null)
          }
          return
        }

        const { data: profile } = await (supabase as any)
          .from("users")
          .select("full_name, email")
          .eq("id", user.id)
          .single()

        const userName = profile?.full_name || profile?.email || "Anonymous"
        const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

        const doc = new Y.Doc()
        docRef.current = doc

        const provider = new SupabaseYjsProvider(documentId, doc)
        providerRef.current = provider

        await provider.connect(user.id, userName, userColor)

        if (mounted) {
          setIsConnected(true)
          setError(null)
          onConnectionChange?.(true)
        }

        const awareness = provider.getAwareness()
        const awarenessChangeHandler = () => {
          const states = awareness.getStates()
          const users: Array<{ id: string; name: string; color: string }> = []

          states.forEach((state) => {
            if (state.user && state.user.id !== user.id) {
              users.push({
                id: state.user.id,
                name: state.user.name,
                color: state.user.color,
              })
            }
          })

          if (mounted) {
            setActiveUsers(users)
            onUsersChange?.(users)
          }
        }

        awareness.on("change", awarenessChangeHandler)

        cleanupFn = () => {
          awareness.off("change", awarenessChangeHandler)
          provider.disconnect()
        }
      } catch (err) {
        console.error("Collaboration initialization error:", err)
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize collaboration")
          setIsConnected(false)
          onConnectionChange?.(false)
        }
      }
    }

    initCollaboration()

    return () => {
      mounted = false
      cleanupFn?.()
    }
  }, [documentId, enabled, onConnectionChange, onUsersChange])

  return {
    doc: docRef.current,
    provider: providerRef.current,
    isConnected,
    activeUsers,
    error,
  }
}

"use client"

import { useEffect, useState, useRef } from "react"
import * as Y from "yjs"
import { useUser } from "@/contexts/UserContext"

/**
 * useCollaboration - Collaborative editing hook
 * 
 * Provides local-only Yjs document support. For true realtime collaboration, implement:
 * - WebSocket server with y-websocket
 * - WebRTC with y-webrtc
 * - Custom signaling server
 */

export interface CollaborationOptions {
  documentId: string
  enabled?: boolean
  onConnectionChange?: (connected: boolean) => void
  onUsersChange?: (users: Array<{ id: string; name: string; color: string }>) => void
}

export function useCollaboration(options: CollaborationOptions) {
  const { documentId, enabled = true, onConnectionChange, onUsersChange } = options
  useUser()

  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const docRef = useRef<Y.Doc | null>(null)

  useEffect(() => {
    if (!enabled || !documentId) {
      return
    }

    // Create local Yjs document (local-only mode)
    const doc = new Y.Doc()
    docRef.current = doc

    // Mark as "connected" for local editing
    setIsConnected(true)
    setError(null)
    onConnectionChange?.(true)

    // No active users without realtime
    setActiveUsers([])
    onUsersChange?.([])

    return () => {
      doc.destroy()
      docRef.current = null
      setIsConnected(false)
      onConnectionChange?.(false)
    }
  }, [documentId, enabled, onConnectionChange, onUsersChange])

  return {
    doc: docRef.current,
    provider: null, // No provider without realtime
    isConnected,
    activeUsers,
    error,
  }
}

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWebSocket } from "@/hooks/useWebSocket"
import type { ChatRequest, ChatRequestStatus } from "@/types/chat-request"

// ============================================================================
// Types
// ============================================================================

interface ChatRequestsState {
  // Requests where current user is the recipient (incoming invitations)
  incomingRequests: ChatRequest[]
  // Requests where current user is the requester (outgoing invitations)
  outgoingRequests: ChatRequest[]
  loading: boolean
  error: string | null
}

interface UseChatRequestsOptions {
  /** Enable polling for incoming requests (default: true) */
  enablePolling?: boolean
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number
  /** Callback when a new incoming request is received */
  onNewRequest?: (request: ChatRequest) => void
  /** Callback when an outgoing request status changes */
  onRequestStatusChange?: (request: ChatRequest) => void
}

interface UseChatRequestsReturn {
  /** Pending chat requests where current user is recipient */
  incomingRequests: ChatRequest[]
  /** Chat requests where current user is requester */
  outgoingRequests: ChatRequest[]
  /** Loading state */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Number of pending incoming requests */
  pendingCount: number
  /** Create a new chat request */
  createRequest: (parentReplyId: string, recipientId?: string) => Promise<ChatRequest | null>
  /** Respond to an incoming chat request */
  respondToRequest: (requestId: string, status: ChatRequestStatus, message?: string) => Promise<boolean>
  /** Cancel an outgoing chat request */
  cancelRequest: (requestId: string) => Promise<boolean>
  /** Manually refresh requests */
  refreshRequests: () => Promise<void>
  /** Get a specific request by ID */
  getRequestById: (requestId: string) => ChatRequest | undefined
}

// ============================================================================
// Hook
// ============================================================================

export function useChatRequests(options: UseChatRequestsOptions = {}): UseChatRequestsReturn {
  const {
    enablePolling = true,
    pollingInterval = 5000,
    onNewRequest,
    onRequestStatusChange,
  } = options

  const [state, setState] = useState<ChatRequestsState>({
    incomingRequests: [],
    outgoingRequests: [],
    loading: true,
    error: null,
  })

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const previousIncomingIdsRef = useRef<Set<string>>(new Set())
  const previousOutgoingStatusRef = useRef<Map<string, ChatRequestStatus>>(new Map())

  // Fetch incoming requests (as recipient)
  const fetchIncomingRequests = useCallback(async (): Promise<ChatRequest[]> => {
    try {
      const response = await fetch("/api/chat-requests?role=recipient&status=pending")
      if (!response.ok) {
        throw new Error("Failed to fetch incoming requests")
      }
      const data = await response.json()
      return data.requests || []
    } catch (error) {
      console.error("[useChatRequests] Error fetching incoming:", error)
      return []
    }
  }, [])

  // Fetch outgoing requests (as requester)
  const fetchOutgoingRequests = useCallback(async (): Promise<ChatRequest[]> => {
    try {
      const response = await fetch("/api/chat-requests?role=requester")
      if (!response.ok) {
        throw new Error("Failed to fetch outgoing requests")
      }
      const data = await response.json()
      return data.requests || []
    } catch (error) {
      console.error("[useChatRequests] Error fetching outgoing:", error)
      return []
    }
  }, [])

  // Refresh all requests
  const refreshRequests = useCallback(async () => {
    try {
      const [incoming, outgoing] = await Promise.all([
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
      ])

      // Check for new incoming requests
      const currentIncomingIds = new Set(incoming.map((r) => r.id))
      for (const request of incoming) {
        if (!previousIncomingIdsRef.current.has(request.id)) {
          onNewRequest?.(request)
        }
      }
      previousIncomingIdsRef.current = currentIncomingIds

      // Check for status changes on outgoing requests
      for (const request of outgoing) {
        const previousStatus = previousOutgoingStatusRef.current.get(request.id)
        if (previousStatus && previousStatus !== request.status) {
          onRequestStatusChange?.(request)
        }
        previousOutgoingStatusRef.current.set(request.id, request.status)
      }

      setState({
        incomingRequests: incoming,
        outgoingRequests: outgoing,
        loading: false,
        error: null,
      })
    } catch (error) {
      console.error("[useChatRequests] Error refreshing:", error)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch requests",
      }))
    }
  }, [fetchIncomingRequests, fetchOutgoingRequests, onNewRequest, onRequestStatusChange])

  // Create a new chat request
  const createRequest = useCallback(async (
    parentReplyId: string,
    recipientId?: string
  ): Promise<ChatRequest | null> => {
    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf_token="))
        ?.split("=")[1]

      const response = await fetch("/api/chat-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          parent_reply_id: parentReplyId,
          recipient_id: recipientId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create request")
      }

      const data = await response.json()
      const newRequest = data.request

      // Update local state
      setState((prev) => ({
        ...prev,
        outgoingRequests: [newRequest, ...prev.outgoingRequests],
      }))

      // Track for status changes
      previousOutgoingStatusRef.current.set(newRequest.id, newRequest.status)

      return newRequest
    } catch (error) {
      console.error("[useChatRequests] Error creating request:", error)
      return null
    }
  }, [])

  // Respond to an incoming request
  const respondToRequest = useCallback(async (
    requestId: string,
    status: ChatRequestStatus,
    message?: string
  ): Promise<boolean> => {
    try {
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf_token="))
        ?.split("=")[1]

      const response = await fetch(`/api/chat-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          status,
          response_message: message,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to respond to request")
      }

      // Remove from incoming requests
      setState((prev) => ({
        ...prev,
        incomingRequests: prev.incomingRequests.filter((r) => r.id !== requestId),
      }))

      return true
    } catch (error) {
      console.error("[useChatRequests] Error responding:", error)
      return false
    }
  }, [])

  // Cancel an outgoing request
  const cancelRequest = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf_token="))
        ?.split("=")[1]

      const response = await fetch(`/api/chat-requests/${requestId}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to cancel request")
      }

      // Update local state
      setState((prev) => ({
        ...prev,
        outgoingRequests: prev.outgoingRequests.map((r) =>
          r.id === requestId ? { ...r, status: "cancelled" as ChatRequestStatus } : r
        ),
      }))

      return true
    } catch (error) {
      console.error("[useChatRequests] Error cancelling:", error)
      return false
    }
  }, [])

  // Get request by ID
  const getRequestById = useCallback((requestId: string): ChatRequest | undefined => {
    return (
      state.incomingRequests.find((r) => r.id === requestId) ||
      state.outgoingRequests.find((r) => r.id === requestId)
    )
  }, [state.incomingRequests, state.outgoingRequests])

  // Extracted WebSocket handlers to reduce function nesting depth
  const handleWsNewRequest = useCallback((payload: ChatRequest) => {
    setState((prev) => {
      if (prev.incomingRequests.some((r) => r.id === payload.id)) return prev
      return { ...prev, incomingRequests: [payload, ...prev.incomingRequests] }
    })
    onNewRequest?.(payload)
  }, [onNewRequest])

  const handleWsUpdatedRequest = useCallback((payload: ChatRequest) => {
    setState((prev) => ({
      ...prev,
      outgoingRequests: prev.outgoingRequests.map((r) =>
        r.id === payload.id ? payload : r
      ),
    }))
    onRequestStatusChange?.(payload)
  }, [onRequestStatusChange])

  const handleWsCancelledRequest = useCallback((payload: { id: string }) => {
    setState((prev) => ({
      ...prev,
      incomingRequests: prev.incomingRequests.filter((r) => r.id !== payload.id),
    }))
  }, [])

  // WebSocket subscription — real-time push events
  const { connected: wsConnected, subscribe } = useWebSocket()

  useEffect(() => {
    if (!wsConnected) return

    const unsubs = [
      subscribe("chat_request.new", handleWsNewRequest),
      subscribe("chat_request.updated", handleWsUpdatedRequest),
      subscribe("chat_request.cancelled", handleWsCancelledRequest),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [wsConnected, subscribe, handleWsNewRequest, handleWsUpdatedRequest, handleWsCancelledRequest])

  // Initial fetch always runs once
  useEffect(() => {
    refreshRequests()
  }, [refreshRequests])

  // Polling fallback — only when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected || !enablePolling) return

    pollIntervalRef.current = setInterval(refreshRequests, pollingInterval)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [wsConnected, enablePolling, pollingInterval, refreshRequests])

  return {
    incomingRequests: state.incomingRequests,
    outgoingRequests: state.outgoingRequests,
    loading: state.loading,
    error: state.error,
    pendingCount: state.incomingRequests.length,
    createRequest,
    respondToRequest,
    cancelRequest,
    refreshRequests,
    getRequestById,
  }
}

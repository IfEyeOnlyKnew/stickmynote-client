"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useChatRequests } from "@/hooks/useChatRequests"
import { ChatRequestToast } from "./ChatRequestToast"
import { ChatInvitationNotification } from "./ChatInvitationNotification"
import type { ChatRequest, ChatRequestStatus } from "@/types/chat-request"

/**
 * Global chat request notification handler
 *
 * This component runs at the app level and:
 * 1. Polls for new incoming chat requests
 * 2. Shows toast notifications when new requests arrive
 * 3. Opens the full invitation modal when user clicks "View Request"
 */
export function ChatRequestNotifications() {
  const [toastRequest, setToastRequest] = useState<ChatRequest | null>(null)
  const [modalRequest, setModalRequest] = useState<ChatRequest | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  // Track which requests we've already shown toasts for
  const shownToastsRef = useRef<Set<string>>(new Set())

  const handleNewRequest = useCallback((request: ChatRequest) => {
    // Only show toast if we haven't shown one for this request yet
    if (!shownToastsRef.current.has(request.id)) {
      shownToastsRef.current.add(request.id)
      setToastRequest(request)
      setShowToast(true)
    }
  }, [])

  const { respondToRequest, refreshRequests } = useChatRequests({
    enablePolling: true,
    pollingInterval: 5000,
    onNewRequest: handleNewRequest,
  })

  // Handle toast dismiss
  const handleToastDismiss = useCallback((requestId: string) => {
    setShowToast(false)
    // Don't clear toastRequest immediately - let animation complete
    setTimeout(() => setToastRequest(null), 300)
  }, [])

  // Handle "View Request" click from toast
  const handleViewRequest = useCallback((request: ChatRequest) => {
    setModalRequest(request)
    setShowToast(false)
  }, [])

  // Handle responding to a request from the modal
  const handleRespond = useCallback(async (
    requestId: string,
    status: ChatRequestStatus,
    message?: string
  ): Promise<boolean> => {
    setRespondingId(requestId)
    const success = await respondToRequest(requestId, status, message)
    setRespondingId(null)

    if (success) {
      setModalRequest(null)
      // Refresh to update counts
      refreshRequests()
    }

    return success
  }, [respondToRequest, refreshRequests])

  // Clean up shown toasts set periodically to prevent memory growth
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Keep only the last 50 request IDs
      if (shownToastsRef.current.size > 50) {
        const ids = Array.from(shownToastsRef.current)
        shownToastsRef.current = new Set(ids.slice(-50))
      }
    }, 60000) // Every minute

    return () => clearInterval(cleanup)
  }, [])

  return (
    <>
      {/* Toast notification for new requests */}
      {toastRequest && showToast && (
        <ChatRequestToast
          request={toastRequest}
          onDismiss={handleToastDismiss}
          onView={handleViewRequest}
        />
      )}

      {/* Full invitation modal */}
      {modalRequest && (
        <ChatInvitationNotification
          request={modalRequest}
          open={!!modalRequest}
          onOpenChange={(open) => !open && setModalRequest(null)}
          onRespond={handleRespond}
        />
      )}
    </>
  )
}

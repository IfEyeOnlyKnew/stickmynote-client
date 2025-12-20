"use client"

/**
 * useRealtimeSticks - Placeholder for realtime stick updates
 * 
 * Realtime updates are not currently implemented. This hook returns a static
 * state indicating no realtime connection. The app functions normally
 * but without live updates from other users.
 * 
 * For live updates, consider implementing:
 * - WebSocket server with PostgreSQL LISTEN/NOTIFY
 * - Server-Sent Events (SSE)
 * - Polling with a configurable interval
 */

// ============================================================================
// Types
// ============================================================================

interface UseRealtimeSticksOptions {
  padId?: string
  onStickCreated?: (stick: SocialStickPayload) => void
  onStickUpdated?: (stick: SocialStickPayload) => void
  onStickDeleted?: (stickId: string) => void
  onReplyCreated?: (reply: ReplyPayload) => void
}

interface SocialStickPayload {
  id: string
  social_pad_id: string
  [key: string]: unknown
}

interface ReplyPayload {
  id: string
  [key: string]: unknown
}

// ============================================================================
// Hook
// ============================================================================

export function useRealtimeSticks(_options: UseRealtimeSticksOptions) {
  // Realtime functionality not implemented - return static state
  return { isConnected: false }
}

"use client"

/**
 * usePresence - Placeholder for presence/collaboration features
 * 
 * Realtime presence is not currently implemented. This hook returns
 * static state indicating no presence connection. The app functions
 * normally but without live presence indicators.
 * 
 * For live presence, consider implementing:
 * - WebSocket server for presence tracking
 * - Server-Sent Events (SSE) with PostgreSQL LISTEN/NOTIFY
 */

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

export function usePresence(_options: UsePresenceOptions = {}) {
  // Presence functionality not implemented - return static state
  return { presenceUsers: [] as PresenceUser[], isConnected: false }
}

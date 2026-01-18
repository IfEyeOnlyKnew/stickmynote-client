"use client"

import { usePresenceHeartbeat } from "@/hooks/usePresence"

/**
 * Component that tracks user presence by sending periodic heartbeats.
 * Renders nothing visible - just manages the heartbeat lifecycle.
 */
export function PresenceTracker() {
  usePresenceHeartbeat()
  return null
}

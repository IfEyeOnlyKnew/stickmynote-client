/**
 * In-process event publisher for WebSocket broadcasting.
 *
 * API routes call these functions to push events to connected clients.
 * Events are delivered directly via the ws-server's connection map
 * (registered on globalThis.__wsBroadcast by ws-server.js).
 *
 * No external message broker needed for single-server deployment.
 */

export interface WsEvent {
  type: string
  payload: unknown
  timestamp: number
}

interface WsBroadcast {
  sendToUser: (userId: string, event: WsEvent) => void
  sendToOrg: (orgId: string, event: WsEvent) => void
  sendToUsers: (userIds: string[], event: WsEvent) => void
}

declare global {
  // eslint-disable-next-line no-var
  var __wsBroadcast: WsBroadcast | undefined
}

function getBroadcast(): WsBroadcast | null {
  return globalThis.__wsBroadcast || null
}

export async function publishToUser(userId: string, event: WsEvent): Promise<void> {
  try {
    const broadcast = getBroadcast()
    if (broadcast) {
      broadcast.sendToUser(userId, event)
    }
  } catch (err) {
    console.error("[WS Publisher] Failed to publish to user:", err)
  }
}

export async function publishToOrg(orgId: string, event: WsEvent): Promise<void> {
  try {
    const broadcast = getBroadcast()
    if (broadcast) {
      broadcast.sendToOrg(orgId, event)
    }
  } catch (err) {
    console.error("[WS Publisher] Failed to publish to org:", err)
  }
}

export async function publishToUsers(userIds: string[], event: WsEvent): Promise<void> {
  try {
    const broadcast = getBroadcast()
    if (broadcast) {
      broadcast.sendToUsers(userIds, event)
    }
  } catch (err) {
    console.error("[WS Publisher] Failed to publish to users:", err)
  }
}

"use client"

import { createClient } from "@/lib/supabase/client"
import * as Y from "yjs"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Awareness } from "y-protocols/awareness"

export interface CollaborationUser {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
}

type PresencePayload = {
  key: string
  newPresences?: any[]
  leftPresences?: any[]
}

type BroadcastPayload = {
  payload?: {
    update?: number[]
    states?: Record<string, any>
    clientId?: number
  }
}

export class SupabaseYjsProvider {
  private doc: Y.Doc
  private channel: RealtimeChannel | null = null
  private awareness: Awareness
  private documentId: string
  private supabase = createClient()
  private isConnected = false
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null = null
  private awarenessUpdateHandler:
    | ((changed: { added: number[]; updated: number[]; removed: number[] }, origin: any) => void)
    | null = null
  private lastAwarenessUpdate = 0
  private awarenessThrottleMs = 1000 // Only send awareness updates once per second
  private pendingAwarenessUpdate: NodeJS.Timeout | null = null

  constructor(documentId: string, doc: Y.Doc) {
    this.documentId = documentId
    this.doc = doc
    this.awareness = new Awareness(this.doc)
  }

  async connect(userId: string, userName: string, userColor: string) {
    if (this.isConnected) {
      return
    }

    try {
      // Create a unique channel for this document
      const channelName = `stick:${this.documentId}:details`

      this.channel = this.supabase.channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: userId },
        },
      })

      // Set local awareness state
      this.awareness.setLocalState({
        user: {
          id: userId,
          name: userName,
          color: userColor,
        },
      })

      if (this.channel) {
        // Handle incoming Yjs updates from other clients
        this.channel.on("broadcast", { event: "yjs-update" }, (payload: BroadcastPayload) => {
          if (payload.payload && payload.payload.update) {
            const update = new Uint8Array(payload.payload.update)
            Y.applyUpdate(this.doc, update, "remote")
          }
        })

        this.channel.on("broadcast", { event: "awareness-update" }, (payload: BroadcastPayload) => {
          if (payload.payload && payload.payload.states) {
            try {
              // Apply each awareness state update
              Object.entries(payload.payload.states).forEach(([clientIdStr, state]) => {
                const clientID = Number.parseInt(clientIdStr, 10)
                if (clientID !== this.doc.clientID) {
                  this.awareness.setLocalStateField(`remote-${clientID}`, state)
                }
              })
            } catch (error) {
              console.error("Error parsing awareness update:", error)
            }
          }
        })

        // Handle presence sync
        this.channel.on("presence", { event: "sync" }, () => {
          // Presence synced
        })

        this.channel.on("presence", { event: "join" }, ({ key, newPresences }: PresencePayload) => {
          // User joined
        })

        this.channel.on("presence", { event: "leave" }, ({ key, leftPresences }: PresencePayload) => {
          // User left
        })

        // Broadcast local Yjs updates to other clients
        this.updateHandler = (update: Uint8Array, origin: any) => {
          if (origin !== "remote" && this.channel) {
            this.channel.send({
              type: "broadcast",
              event: "yjs-update",
              payload: { update: Array.from(update) },
            })
          }
        }
        this.doc.on("update", this.updateHandler)

        this.awarenessUpdateHandler = (
          changed: { added: number[]; updated: number[]; removed: number[] },
          origin: any,
        ) => {
          if (origin !== "remote" && this.channel) {
            // Clear any pending update
            if (this.pendingAwarenessUpdate) {
              clearTimeout(this.pendingAwarenessUpdate)
            }

            // Throttle awareness updates
            const now = Date.now()
            const timeSinceLastUpdate = now - this.lastAwarenessUpdate

            if (timeSinceLastUpdate >= this.awarenessThrottleMs) {
              // Send immediately if enough time has passed
              this.broadcastAwarenessUpdate(changed)
              this.lastAwarenessUpdate = now
            } else {
              // Schedule for later
              this.pendingAwarenessUpdate = setTimeout(() => {
                this.broadcastAwarenessUpdate(changed)
                this.lastAwarenessUpdate = Date.now()
                this.pendingAwarenessUpdate = null
              }, this.awarenessThrottleMs - timeSinceLastUpdate)
            }
          }
        }
        this.awareness.on("update", this.awarenessUpdateHandler)

        // Subscribe to the channel
        await this.channel.subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            this.isConnected = true

            // Track presence
            await this.channel?.track({
              user: {
                id: userId,
                name: userName,
                color: userColor,
              },
              online_at: new Date().toISOString(),
            })

            // Request initial state from other clients
            this.channel?.send({
              type: "broadcast",
              event: "request-state",
              payload: { clientId: this.doc.clientID },
            })
          }
        })

        // Handle state requests from new clients
        this.channel.on("broadcast", { event: "request-state" }, (payload: BroadcastPayload) => {
          if (payload.payload && payload.payload.clientId !== this.doc.clientID) {
            const stateVector = Y.encodeStateAsUpdate(this.doc)
            this.channel?.send({
              type: "broadcast",
              event: "yjs-update",
              payload: { update: Array.from(stateVector) },
            })
          }
        })
      }
    } catch (error) {
      console.error("Error connecting to collaboration channel:", error)
      throw error
    }
  }

  async disconnect() {
    if (this.pendingAwarenessUpdate) {
      clearTimeout(this.pendingAwarenessUpdate)
      this.pendingAwarenessUpdate = null
    }

    if (this.updateHandler) {
      this.doc.off("update", this.updateHandler)
      this.updateHandler = null
    }

    if (this.awarenessUpdateHandler) {
      this.awareness.off("update", this.awarenessUpdateHandler)
      this.awarenessUpdateHandler = null
    }

    if (this.channel) {
      await this.channel.unsubscribe()
      this.channel = null
    }

    this.isConnected = false
  }

  getAwareness(): Awareness {
    return this.awareness
  }

  getDoc(): Y.Doc {
    return this.doc
  }

  isReady(): boolean {
    return this.isConnected
  }

  private broadcastAwarenessUpdate(changed: { added: number[]; updated: number[]; removed: number[] }) {
    if (!this.channel) return

    const changedClients = changed.added.concat(changed.updated).concat(changed.removed)

    // Only broadcast if there are actual changes
    if (changedClients.length === 0) return

    const states: Record<string, any> = {}

    changedClients.forEach((clientID) => {
      const state = this.awareness.getStates().get(clientID)
      if (state) {
        states[clientID.toString()] = state
      }
    })

    // Only send if we have states to broadcast
    if (Object.keys(states).length > 0) {
      this.channel.send({
        type: "broadcast",
        event: "awareness-update",
        payload: { states },
      })
    }
  }
}

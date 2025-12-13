import { createSupabaseBrowser } from "@/lib/supabase-browser"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface PresenceUser {
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
  lastSeen: number
}

export class PresenceService {
  private channel: RealtimeChannel | null = null
  private supabase = createSupabaseBrowser()
  private presenceState: Map<string, PresenceUser> = new Map()
  private listeners: Set<(users: PresenceUser[]) => void> = new Set()

  constructor(private roomId: string) {}

  async join(user: { id: string; name: string; email: string; avatarUrl?: string }) {
    if (this.channel) {
      console.log("[v0] Already joined presence channel")
      return
    }

    this.channel = this.supabase.channel(`presence:${this.roomId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    // Track presence state changes
    if (this.channel) {
      this.channel
        .on("presence", { event: "sync" }, () => {
          const state = this.channel?.presenceState() || {}
          this.updatePresenceState(state)
        })
        .on("presence", { event: "join" }, ({ key, newPresences }: { key: string; newPresences: PresenceUser[] }) => {
          console.log("[v0] User joined:", key, newPresences)
          const state = this.channel?.presenceState() || {}
          this.updatePresenceState(state)
        })
        .on(
          "presence",
          { event: "leave" },
          ({ key, leftPresences }: { key: string; leftPresences: PresenceUser[] }) => {
            console.log("[v0] User left:", key, leftPresences)
            const state = this.channel?.presenceState() || {}
            this.updatePresenceState(state)
          },
        )

      await this.channel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await this.channel?.track({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            avatarUrl: user.avatarUrl,
            lastSeen: Date.now(),
          })
        }
      })
    }
  }

  async updateCursor(x: number, y: number) {
    if (!this.channel) return
    await this.channel.track({ cursor: { x, y }, lastSeen: Date.now() })
  }

  async updateActiveElement(elementId: string) {
    if (!this.channel) return
    await this.channel.track({ activeElement: elementId, lastSeen: Date.now() })
  }

  async setTyping(isTyping: boolean) {
    if (!this.channel) return
    await this.channel.track({ isTyping, lastSeen: Date.now() })
  }

  private updatePresenceState(state: Record<string, any>) {
    this.presenceState.clear()

    Object.entries(state).forEach(([key, presences]) => {
      const presence = Array.isArray(presences) ? presences[0] : presences
      if (presence) {
        this.presenceState.set(key, presence as PresenceUser)
      }
    })

    this.notifyListeners()
  }

  private notifyListeners() {
    const users = Array.from(this.presenceState.values())
    this.listeners.forEach((listener) => listener(users))
  }

  onPresenceChange(callback: (users: PresenceUser[]) => void) {
    this.listeners.add(callback)
    // Immediately call with current state
    callback(Array.from(this.presenceState.values()))

    return () => {
      this.listeners.delete(callback)
    }
  }

  getPresenceUsers(): PresenceUser[] {
    return Array.from(this.presenceState.values())
  }

  async leave() {
    if (this.channel) {
      await this.channel.untrack()
      await this.supabase.removeChannel(this.channel)
      this.channel = null
      this.presenceState.clear()
      this.listeners.clear()
    }
  }
}

export interface PresenceUser {
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
  lastSeen: number
}

/**
 * PresenceService - Polling-based presence tracking
 * Uses periodic polling for lightweight presence updates.
 */
export class PresenceService {
  private readonly presenceState: Map<string, PresenceUser> = new Map()
  private readonly listeners: Set<(users: PresenceUser[]) => void> = new Set()
  private pollInterval: NodeJS.Timeout | null = null
  private currentUser: { id: string; name: string; email: string; avatarUrl?: string } | null = null

  async join(user: { id: string; name: string; email: string; avatarUrl?: string }) {
    this.currentUser = user
    
    // Add self to presence state
    this.presenceState.set(user.id, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      avatarUrl: user.avatarUrl,
      lastSeen: Date.now(),
    })
    
    this.notifyListeners()
    
    // Start polling for presence updates
    this.pollInterval = setInterval(() => {
      this.pollPresence()
    }, 10000) // Poll every 10 seconds
    
    // Also poll immediately
    this.pollPresence()
  }

  private async pollPresence() {
    try {
      // Update our own last seen time
      if (this.currentUser) {
        const existing = this.presenceState.get(this.currentUser.id)
        if (existing) {
          existing.lastSeen = Date.now()
        }
      }
      
      // Remove users who haven't been seen in 30 seconds
      const now = Date.now()
      const staleThreshold = 30000
      
      for (const [userId, userData] of this.presenceState.entries()) {
        if (userId !== this.currentUser?.id && now - userData.lastSeen > staleThreshold) {
          this.presenceState.delete(userId)
        }
      }
      
      this.notifyListeners()
    } catch (error) {
      console.error("[PresenceService] Error polling presence:", error)
    }
  }

  async updateCursor(x: number, y: number) {
    // Cursor tracking would require a backend service
    // For now, this is a no-op
  }

  async updateActiveElement(elementId: string) {
    // Active element tracking would require a backend service
    // For now, this is a no-op
  }

  async setTyping(isTyping: boolean) {
    // Typing indicator would require a backend service
    // For now, this is a no-op
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
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.presenceState.clear()
    this.listeners.clear()
    this.currentUser = null
  }
}

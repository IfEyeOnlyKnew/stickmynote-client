import memjs from "memjs"

/**
 * Pad Chat Caching Layer
 *
 * Provides fast caching for frequently accessed Pad Chat data:
 * - Chat settings (TTL: 5 minutes)
 * - Moderator lists (TTL: 2 minutes)
 * - User info (TTL: 10 minutes)
 *
 * Uses Memcached for distributed caching.
 * Falls back to in-memory cache when Memcached is unavailable.
 */

// Cache TTLs in seconds
const TTL = {
  SETTINGS: 300, // 5 minutes
  MODERATORS: 120, // 2 minutes
  USER_INFO: 600, // 10 minutes
  PRESENCE: 60, // 1 minute (for future use)
} as const

// Types
interface CachedSettings {
  private_conversations: boolean
  chat_enabled: boolean
  ai_enabled: boolean
  [key: string]: unknown
}

interface CachedModerators {
  ids: string[]
  ownerId: string | null
}

interface CachedUserInfo {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

type CacheValue = CachedSettings | CachedModerators | CachedUserInfo | string[]

// In-memory fallback cache
interface MemoryCacheEntry<T> {
  value: T
  expiresAt: number
}

class PadChatCache {
  private memcached: memjs.Client | null = null
  private readonly memoryCache = new Map<string, MemoryCacheEntry<CacheValue>>()
  private initialized = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    try {
      // Get Memcached server from environment or use default
      const memcachedServers = process.env.MEMCACHED_SERVERS || "192.168.50.50:11211"

      this.memcached = memjs.Client.create(memcachedServers, {
        retries: 2,
        retry_delay: 0.2,
        failover: true,
      })
      this.initialized = true
    } catch {
      this.memcached = null
    }
  }

  // ============================================================================
  // Cache Key Generators
  // ============================================================================

  private settingsKey(padId: string): string {
    return `pad:settings:${padId}`
  }

  private moderatorsKey(padId: string): string {
    return `pad:mods:${padId}`
  }

  private userKey(userId: string): string {
    return `user:info:${userId}`
  }

  // ============================================================================
  // Settings Cache
  // ============================================================================

  async getSettings(padId: string): Promise<CachedSettings | null> {
    const key = this.settingsKey(padId)
    return this.get<CachedSettings>(key)
  }

  async setSettings(padId: string, settings: CachedSettings): Promise<void> {
    const key = this.settingsKey(padId)
    await this.set(key, settings, TTL.SETTINGS)
  }

  async invalidateSettings(padId: string): Promise<void> {
    const key = this.settingsKey(padId)
    await this.delete(key)
  }

  // ============================================================================
  // Moderators Cache
  // ============================================================================

  async getModerators(padId: string): Promise<CachedModerators | null> {
    const key = this.moderatorsKey(padId)
    return this.get<CachedModerators>(key)
  }

  async setModerators(padId: string, data: CachedModerators): Promise<void> {
    const key = this.moderatorsKey(padId)
    await this.set(key, data, TTL.MODERATORS)
  }

  async invalidateModerators(padId: string): Promise<void> {
    const key = this.moderatorsKey(padId)
    await this.delete(key)
  }

  // ============================================================================
  // User Info Cache (batch support)
  // ============================================================================

  async getUser(userId: string): Promise<CachedUserInfo | null> {
    const key = this.userKey(userId)
    return this.get<CachedUserInfo>(key)
  }

  async setUser(userId: string, user: CachedUserInfo): Promise<void> {
    const key = this.userKey(userId)
    await this.set(key, user, TTL.USER_INFO)
  }

  async getUsers(userIds: string[]): Promise<Map<string, CachedUserInfo>> {
    const result = new Map<string, CachedUserInfo>()
    if (userIds.length === 0) return result

    // Memcached doesn't have native batch get, fetch individually
    // For high-volume scenarios, consider using memcached's getMulti if needed
    try {
      const promises = userIds.map(async (userId) => {
        const cached = await this.getUser(userId)
        if (cached) {
          result.set(userId, cached)
        }
      })
      await Promise.all(promises)
    } catch {
      // Silent fail - return what we have
    }

    return result
  }

  async setUsers(users: CachedUserInfo[]): Promise<void> {
    if (users.length === 0) return

    try {
      const promises = users.map((user) => this.setUser(user.id, user))
      await Promise.all(promises)
    } catch {
      // Silent fail
    }
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  private async get<T extends CacheValue>(key: string): Promise<T | null> {
    try {
      if (this.memcached) {
        const { value } = await this.memcached.get(key)
        if (value) {
          return JSON.parse(value.toString()) as T
        }
        return null
      }

      // Memory fallback
      const entry = this.memoryCache.get(key) as MemoryCacheEntry<T> | undefined
      if (entry && entry.expiresAt > Date.now()) {
        return entry.value
      }
      if (entry) {
        this.memoryCache.delete(key)
      }
      return null
    } catch {
      return null
    }
  }

  private async set(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
    try {
      if (this.memcached) {
        await this.memcached.set(key, JSON.stringify(value), { expires: ttlSeconds })
      } else {
        // Memory fallback
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        })
      }
    } catch {
      // Silent fail
    }
  }

  private async delete(key: string): Promise<void> {
    try {
      if (this.memcached) {
        await this.memcached.delete(key)
      }
      this.memoryCache.delete(key)
    } catch {
      // Silent fail
    }
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async healthCheck(): Promise<{ memcached: boolean; memoryEntries: number }> {
    let memcachedOk = false
    try {
      if (this.memcached) {
        // Simple test: set and get a test key
        const testKey = "health:check"
        await this.memcached.set(testKey, "ok", { expires: 10 })
        const { value } = await this.memcached.get(testKey)
        memcachedOk = value?.toString() === "ok"
      }
    } catch {
      memcachedOk = false
    }

    // Cleanup expired memory entries
    const now = Date.now()
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key)
      }
    }

    return {
      memcached: memcachedOk,
      memoryEntries: this.memoryCache.size,
    }
  }

  isMemcachedAvailable(): boolean {
    return this.initialized && this.memcached !== null
  }

  async close(): Promise<void> {
    if (this.memcached) {
      this.memcached.close()
    }
  }
}

// Singleton export
export const padChatCache = new PadChatCache()

// Type exports for use in API routes
export type { CachedSettings, CachedModerators, CachedUserInfo }

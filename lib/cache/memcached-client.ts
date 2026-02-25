import memjs from "memjs"

/**
 * Memcached caching client with in-memory fallback.
 *
 * Connects to Memcached server defined by MEMCACHE_SERVERS env var.
 * Falls back to an in-memory Map if Memcached is unavailable.
 */
class MemcachedCache {
  private client: memjs.Client | null = null
  private fallbackMap = new Map<string, { value: string; expiresAt: number | null }>()
  private isAvailable = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    const servers = process.env.MEMCACHE_SERVERS
    if (!servers) {
      console.warn("[Memcached] MEMCACHE_SERVERS not set, using in-memory fallback")
      return
    }

    try {
      this.client = memjs.Client.create(servers, {
        retries: 2,
        retry_delay: 0.2,
        failover: true,
        timeout: 5,
        keepAlive: true,
      })

      // Test connection
      this.client.stats((err) => {
        if (err) {
          console.warn("[Memcached] Connection test failed, using fallback:", err.message)
          this.isAvailable = false
        } else {
          console.log("[Memcached] Connected successfully to", servers)
          this.isAvailable = true
        }
      })
    } catch (error) {
      console.error("[Memcached] Initialization error:", error)
      this.client = null
      this.isAvailable = false
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.isAvailable) {
      try {
        const { value } = await this.client.get(key)
        if (value) {
          return value.toString()
        }
        return null
      } catch (error) {
        console.error("[Memcached] GET error, using fallback:", error)
      }
    }

    // Fallback
    const item = this.fallbackMap.get(key)
    if (!item) return null
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.fallbackMap.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: string, options?: { ex?: number; px?: number }): Promise<void> {
    // Calculate TTL in seconds for Memcached
    let ttl = 0
    if (options?.ex) {
      ttl = options.ex
    } else if (options?.px) {
      ttl = Math.ceil(options.px / 1000)
    }

    if (this.client && this.isAvailable) {
      try {
        await this.client.set(key, value, { expires: ttl })
        return
      } catch (error) {
        console.error("[Memcached] SET error, using fallback:", error)
      }
    }

    // Fallback
    let expiresAt: number | null = null
    if (options?.ex) {
      expiresAt = Date.now() + options.ex * 1000
    } else if (options?.px) {
      expiresAt = Date.now() + options.px
    }
    this.fallbackMap.set(key, { value, expiresAt })
  }

  async del(key: string): Promise<void> {
    if (this.client && this.isAvailable) {
      try {
        await this.client.delete(key)
        return
      } catch (error) {
        console.error("[Memcached] DEL error, using fallback:", error)
      }
    }

    // Fallback
    this.fallbackMap.delete(key)
  }

  async incr(key: string): Promise<number> {
    if (this.client && this.isAvailable) {
      try {
        const result = await this.client.increment(key, 1, { initial: 1 })
        if (result.value != null) {
          return result.value
        }
      } catch (error) {
        console.error("[Memcached] INCR error, using fallback:", error)
      }
    }

    // Fallback
    const current = this.fallbackMap.get(key)
    const newValue = (current ? Number.parseInt(current.value) : 0) + 1
    this.fallbackMap.set(key, { value: String(newValue), expiresAt: null })
    return newValue
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (this.client && this.isAvailable) {
      try {
        // Memcached doesn't have a standalone expire — touch (set new expiry)
        await this.client.touch(key, seconds)
        return
      } catch (error) {
        console.error("[Memcached] EXPIRE error, using fallback:", error)
      }
    }

    // Fallback
    const item = this.fallbackMap.get(key)
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000
    }
  }

  async ping(): Promise<boolean> {
    if (this.client && this.isAvailable) {
      try {
        return await new Promise((resolve) => {
          this.client!.stats((err) => {
            resolve(!err)
          })
        })
      } catch {
        return false
      }
    }
    return false
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string; usingFallback: boolean }> {
    const pingSuccess = await this.ping()

    return {
      healthy: pingSuccess || this.fallbackMap.size >= 0,
      message: pingSuccess ? "Memcached connected successfully" : "Memcached unavailable, using in-memory fallback",
      usingFallback: !pingSuccess,
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    for (const [key, item] of this.fallbackMap.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.fallbackMap.delete(key)
      }
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close()
      this.client = null
    }
  }
}

// Singleton instance
export const cache = new MemcachedCache()

// Cleanup expired keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      cache.cleanup().catch(() => {})
    },
    5 * 60 * 1000,
  )
}

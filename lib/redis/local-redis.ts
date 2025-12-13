import Redis from "ioredis"

class LocalRedis {
  private client: Redis | null = null
  private fallbackMap = new Map<string, { value: any; expiresAt: number | null }>()
  private isRedisAvailable = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

    try {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn("[Redis] Max retries reached, using fallback")
            return null
          }
          return Math.min(times * 100, 3000)
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })

      this.client.on("connect", () => {
        console.log("[Redis] Connected successfully")
        this.isRedisAvailable = true
      })

      this.client.on("error", (error) => {
        console.error("[Redis] Connection error:", error)
        this.isRedisAvailable = false
      })

      this.client.on("close", () => {
        console.warn("[Redis] Connection closed, using fallback")
        this.isRedisAvailable = false
      })

      // Attempt connection
      this.client.connect().catch((error) => {
        console.error("[Redis] Initial connection failed:", error)
        this.isRedisAvailable = false
      })
    } catch (error) {
      console.error("[Redis] Initialization error:", error)
      this.client = null
      this.isRedisAvailable = false
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.isRedisAvailable) {
      try {
        return await this.client.get(key)
      } catch (error) {
        console.error("[Redis] GET error, using fallback:", error)
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
    if (this.client && this.isRedisAvailable) {
      try {
        if (options?.ex) {
          await this.client.setex(key, options.ex, value)
        } else if (options?.px) {
          await this.client.psetex(key, options.px, value)
        } else {
          await this.client.set(key, value)
        }
        return
      } catch (error) {
        console.error("[Redis] SET error, using fallback:", error)
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
    if (this.client && this.isRedisAvailable) {
      try {
        await this.client.del(key)
        return
      } catch (error) {
        console.error("[Redis] DEL error, using fallback:", error)
      }
    }

    // Fallback
    this.fallbackMap.delete(key)
  }

  async incr(key: string): Promise<number> {
    if (this.client && this.isRedisAvailable) {
      try {
        return await this.client.incr(key)
      } catch (error) {
        console.error("[Redis] INCR error, using fallback:", error)
      }
    }

    // Fallback
    const current = this.fallbackMap.get(key)
    const newValue = (current ? Number.parseInt(current.value) : 0) + 1
    this.fallbackMap.set(key, { value: String(newValue), expiresAt: null })
    return newValue
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (this.client && this.isRedisAvailable) {
      try {
        await this.client.expire(key, seconds)
        return
      } catch (error) {
        console.error("[Redis] EXPIRE error, using fallback:", error)
      }
    }

    // Fallback
    const item = this.fallbackMap.get(key)
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000
    }
  }

  async ping(): Promise<boolean> {
    if (this.client && this.isRedisAvailable) {
      try {
        const result = await this.client.ping()
        return result === "PONG"
      } catch (error) {
        return false
      }
    }
    return false
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string; usingFallback: boolean }> {
    const pingSuccess = await this.ping()

    return {
      healthy: pingSuccess || this.fallbackMap.size >= 0,
      message: pingSuccess ? "Redis connected successfully" : "Redis unavailable, using in-memory fallback",
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
      await this.client.quit()
      this.client = null
    }
  }
}

// Singleton instance
export const redis = new LocalRedis()

// Cleanup expired keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      redis.cleanup().catch(() => {})
    },
    5 * 60 * 1000,
  )
}

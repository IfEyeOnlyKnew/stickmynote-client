import { Redis } from "@upstash/redis"

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

interface RateLimitConfig {
  requests: number
  window: number // in seconds
  identifier: string
}

type Provider = "upstash-redis" | "upstash-kv" | "memory"

class RedisRateLimiter {
  private redis: Redis | null = null
  private fallbackMap = new Map<string, { count: number; resetTime: number }>()
  private provider: Provider = "memory"
  private envConfigured = false
  private initWarning: string | null = null

  constructor() {
    this.initialize()
  }

  private initialize() {
    try {
      // Prefer Upstash Redis REST if valid (must be https://), else use KV REST. Ignore rediss:// connection strings for REST client.
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
      const kvUrl = process.env.KV_REST_API_URL
      const kvToken = process.env.KV_REST_API_TOKEN

      // Validate REST URL schemes
      const upstashRestUsable = Boolean(upstashUrl && upstashToken && upstashUrl.startsWith("https://"))
      const kvRestUsable = Boolean(kvUrl && kvToken && kvUrl.startsWith("https://"))

      if (upstashUrl && !upstashRestUsable) {
        this.initWarning =
          "UPSTASH_REDIS_REST_URL is not an https:// REST URL (likely a rediss:// connection string). Falling back to KV REST if available."
      }

      let selectedUrl: string | undefined
      let selectedToken: string | undefined

      if (upstashRestUsable) {
        selectedUrl = upstashUrl as string
        selectedToken = upstashToken as string
        this.provider = "upstash-redis"
      } else if (kvRestUsable) {
        selectedUrl = kvUrl as string
        selectedToken = kvToken as string
        this.provider = "upstash-kv"
      } else {
        // Neither REST provider is properly configured. We will use in-memory fallback.
        this.provider = "memory"
      }

      if (selectedUrl && selectedToken) {
        this.redis = new Redis({ url: selectedUrl, token: selectedToken })
        this.envConfigured = true
      } else {
        this.redis = null
        this.envConfigured = false
      }
    } catch (error) {
      this.redis = null
      this.provider = "memory"
      this.envConfigured = false
    }
  }

  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { requests, window, identifier } = config
    const key = `rate_limit:${identifier}`
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - window

    try {
      if (this.redis) {
        return await this.redisRateLimit(key, requests, window, now, windowStart)
      }
      return this.fallbackRateLimit(identifier, requests, window * 1000, now * 1000)
    } catch (error) {
      return this.fallbackRateLimit(identifier, requests, window * 1000, now * 1000)
    }
  }

  private async redisRateLimit(
    key: string,
    limit: number,
    window: number,
    now: number,
    windowStart: number,
  ): Promise<RateLimitResult> {
    // Sliding window with sorted set
    const pipeline = this.redis!.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart)
    pipeline.zcard(key)
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` })
    pipeline.expire(key, window + 1)
    const results = await pipeline.exec()

    if (!results || results.length < 2) {
      throw new Error("Invalid Redis pipeline response")
    }

    const currentCount = (results[1] as number) || 0
    const remaining = Math.max(0, limit - currentCount - 1)
    const reset = now + window

    return {
      success: currentCount < limit,
      limit,
      remaining,
      reset,
      retryAfter: currentCount >= limit ? window : undefined,
    }
  }

  private fallbackRateLimit(identifier: string, limit: number, windowMs: number, nowMs: number): RateLimitResult {
    const existing = this.fallbackMap.get(identifier)
    const reset = Math.floor((nowMs + windowMs) / 1000)

    if (!existing || nowMs > existing.resetTime) {
      this.fallbackMap.set(identifier, { count: 1, resetTime: nowMs + windowMs })
      return { success: true, limit, remaining: limit - 1, reset }
    }

    if (existing.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.floor(existing.resetTime / 1000),
        retryAfter: Math.ceil((existing.resetTime - nowMs) / 1000),
      }
    }

    existing.count++
    return { success: true, limit, remaining: limit - existing.count, reset: Math.floor(existing.resetTime / 1000) }
  }

  async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      for (const [key, value] of this.fallbackMap.entries()) {
        if (now > value.resetTime) {
          this.fallbackMap.delete(key)
        }
      }
    } catch (error) {
      // Cleanup error - fail silently
    }
  }

  async healthCheck(): Promise<{
    redis: boolean
    fallback: boolean
    provider: Provider
    envConfigured: boolean
    warning?: string | null
  }> {
    try {
      if (this.redis) {
        await this.redis.ping()
        return {
          redis: true,
          fallback: true,
          provider: this.provider,
          envConfigured: this.envConfigured,
          warning: this.initWarning ?? null,
        }
      }
      return {
        redis: false,
        fallback: true,
        provider: this.provider,
        envConfigured: this.envConfigured,
        warning: this.initWarning ?? null,
      }
    } catch (error) {
      return {
        redis: false,
        fallback: true,
        provider: this.provider,
        envConfigured: this.envConfigured,
        warning: this.initWarning ?? null,
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RedisRateLimiter()

// Periodic cleanup for memory fallback (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      rateLimiter.cleanup().catch(() => {})
    },
    5 * 60 * 1000,
  )
}

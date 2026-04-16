import { Redis } from "@upstash/redis"

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix: string
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  headers: Record<string, string>
}

const FORCE_MEMORY =
  process.env.RATE_LIMIT_FORCE_MEMORY === "1" ||
  process.env.DISABLE_RATE_LIMIT_REDIS === "1" ||
  process.env.NODE_ENV !== "production"

// Rate limit configurations
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  notes_read: { windowMs: 60000, maxRequests: 100, keyPrefix: "rl:notes:read" },
  notes_create: {
    windowMs: 60000,
    maxRequests: 10,
    keyPrefix: "rl:notes:create",
  },
  notes_update: {
    windowMs: 60000,
    maxRequests: 20,
    keyPrefix: "rl:notes:update",
  },
  notes_delete: {
    windowMs: 60000,
    maxRequests: 5,
    keyPrefix: "rl:notes:delete",
  },
  auth_login: { windowMs: 300000, maxRequests: 5, keyPrefix: "rl:auth:login" }, // 5 attempts per 5 minutes
  auth_email: { windowMs: 300000, maxRequests: 3, keyPrefix: "rl:auth:email" }, // 3 emails per 5 minutes
  ai_generate_tags: { windowMs: 60000, maxRequests: 10, keyPrefix: "rl:ai:tags" }, // 10 per minute
  ai_summarize: { windowMs: 60000, maxRequests: 5, keyPrefix: "rl:ai:summarize" }, // 5 per minute
  auth: { windowMs: 300000, maxRequests: 5, keyPrefix: "rl:auth" },
  api_general: { windowMs: 60000, maxRequests: 60, keyPrefix: "rl:api" },
}

export class EnhancedRateLimiter {
  private readonly redis: Redis | null = null
  private readonly memoryStore = new Map<string, { count: number; resetTime: number }>()

  constructor() {
    if (!FORCE_MEMORY && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      this.redis = new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    } else {
      this.redis = null
    }

    // Clean up memory store every 5 minutes
    setInterval(() => this.cleanupMemoryStore(), 5 * 60 * 1000)
  }

  private cleanupMemoryStore() {
    const now = Date.now()
    for (const [key, value] of this.memoryStore.entries()) {
      if (now > value.resetTime) {
        this.memoryStore.delete(key)
      }
    }
  }

  private getClientIdentifier(request: Request, userId?: string): string {
    // Use user ID if available, otherwise fall back to IP
    if (userId) return userId

    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown"
    return ip
  }

  async checkRateLimit(request: Request, userId: string | undefined, action: string): Promise<RateLimitResult> {
    const config = RATE_LIMIT_CONFIGS[action] || RATE_LIMIT_CONFIGS.api_general
    const clientId = this.getClientIdentifier(request, userId)
    const key = `${config.keyPrefix}:${clientId}`
    const now = Date.now()
    const windowStart = now - config.windowMs

    try {
      if (this.redis) {
        return await this.checkRedisRateLimit(key, config, now, windowStart)
      } else {
        return this.checkMemoryRateLimit(key, config, now, windowStart)
      }
    } catch (error) {
      console.warn("Rate limiting error (fail-open):", error)
      // Fail open - allow request if rate limiting fails
      const now = Date.now()
      const config = RATE_LIMIT_CONFIGS[action] || RATE_LIMIT_CONFIGS.api_general
      return {
        success: true,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - 1),
        resetTime: now + config.windowMs,
        headers: this.getRateLimitHeaders(
          config.maxRequests,
          Math.max(0, config.maxRequests - 1),
          now + config.windowMs,
        ),
      }
    }
  }

  private async checkRedisRateLimit(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number,
  ): Promise<RateLimitResult> {
    try {
      const pipeline = this.redis!.pipeline()

      // Remove old entries
      pipeline.zremrangebyscore(key, 0, windowStart)

      // Count current requests
      pipeline.zcard(key)

      // Add current request
      pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` })

      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000))

      const results = await pipeline.exec()
      const currentCount = (results[1] as number) + 1 // +1 for the request we just added

      const success = currentCount <= config.maxRequests
      const remaining = Math.max(0, config.maxRequests - currentCount)
      const resetTime = now + config.windowMs

      return {
        success,
        limit: config.maxRequests,
        remaining,
        resetTime,
        headers: this.getRateLimitHeaders(config.maxRequests, remaining, resetTime),
      }
    } catch (err) {
      // Any Redis/Upstash hiccup should never block the request
      console.warn("Redis pipeline error (fail-open):", err)
      return {
        success: true,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - 1),
        resetTime: now + config.windowMs,
        headers: this.getRateLimitHeaders(
          config.maxRequests,
          Math.max(0, config.maxRequests - 1),
          now + config.windowMs,
        ),
      }
    }
  }

  private checkMemoryRateLimit(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number,
  ): RateLimitResult {
    const record = this.memoryStore.get(key)

    if (!record || now > record.resetTime) {
      // New window
      this.memoryStore.set(key, { count: 1, resetTime: now + config.windowMs })
      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        headers: this.getRateLimitHeaders(config.maxRequests, config.maxRequests - 1, now + config.windowMs),
      }
    }

    // Existing window
    record.count++
    const success = record.count <= config.maxRequests
    const remaining = Math.max(0, config.maxRequests - record.count)

    return {
      success,
      limit: config.maxRequests,
      remaining,
      resetTime: record.resetTime,
      headers: this.getRateLimitHeaders(config.maxRequests, remaining, record.resetTime),
    }
  }

  private getRateLimitHeaders(limit: number, remaining: number, resetTime: number): Record<string, string> {
    return {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
    }
  }
}

// Create singleton instance
const rateLimiter = new EnhancedRateLimiter()

// Main export function
export async function applyRateLimit(
  request: Request,
  userId: string | undefined,
  action: string,
): Promise<RateLimitResult> {
  try {
    return await rateLimiter.checkRateLimit(request, userId, action)
  } catch (e) {
    console.warn("applyRateLimit fatal error (fail-open):", e)
    const config = RATE_LIMIT_CONFIGS[action] || RATE_LIMIT_CONFIGS.api_general
    const now = Date.now()
    return {
      success: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - 1),
      resetTime: now + config.windowMs,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(Math.max(0, config.maxRequests - 1)),
        "X-RateLimit-Reset": String(Math.ceil((now + config.windowMs) / 1000)),
      },
    }
  }
}

// Backward compatibility
export async function withRateLimit(action: string) {
  return async (request: Request, userId?: string) => {
    const result = await applyRateLimit(request, userId, action)
    if (!result.success) {
      return new Response("Rate limit exceeded", {
        status: 429,
        headers: {
          "Retry-After": "60",
          ...result.headers,
        },
      })
    }
    return null
  }
}

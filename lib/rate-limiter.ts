/**
 * Rate Limiter using local PostgreSQL
 * 
 * Uses the database queries module to track rate limits
 */
import { getRateLimitCount, createRateLimit, cleanupOldRateLimits } from "@/lib/database/queries"

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  "create-note": { windowMs: 60 * 1000, maxRequests: 10 }, // 10 notes per minute
  "create-reply": { windowMs: 60 * 1000, maxRequests: 20 }, // 20 replies per minute
  search: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 searches per minute
  "update-profile": { windowMs: 60 * 1000, maxRequests: 5 }, // 5 profile updates per minute
  general: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 general requests per minute
}

export async function checkRateLimit(
  userId: string,
  action: string,
  ip?: string,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const config = rateLimitConfigs[action] || rateLimitConfigs.general
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Clean up old entries
    await cleanupOldRateLimits(windowStart)

    // Count current requests in window
    const identifier = userId || ip || "anonymous"
    const endpoint = action
    const currentCount = await getRateLimitCount(identifier, endpoint, windowStart)

    if (currentCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + config.windowMs,
      }
    }

    // Record this request
    await createRateLimit(identifier, endpoint)

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetTime: now + config.windowMs,
    }
  } catch (error) {
    console.error("Rate limiter error:", error)
    // Fail open - allow the request
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    }
  }
}

export function getRateLimitHeaders(result: {
  remaining: number
  resetTime: number
}) {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
  }
}

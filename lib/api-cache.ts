import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

let redis: Redis | null = null

try {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  // Only initialize Redis if we have valid REST API credentials (https://)
  if (url && token && url.startsWith("https://")) {
    redis = new Redis({ url, token })
  } else if (url && !url.startsWith("https://")) {
    console.warn("[APICache] UPSTASH_REDIS_REST_URL is not an https:// REST URL. Caching disabled.")
  }
} catch (error) {
  console.warn("[APICache] Failed to initialize Redis client:", error)
}

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
  staleWhileRevalidate?: number // SWR time in seconds
}

export class APICache {
  private static readonly DEFAULT_TTL = 60 // 1 minute
  private static readonly DEFAULT_SWR = 300 // 5 minutes

  /**
   * Generate a cache key from request parameters
   */
  static getCacheKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${key}=${params[key]}`)
      .join("&")
    return `api:${endpoint}:${sortedParams}`
  }

  /**
   * Get cached response
   */
  static async get<T = any>(key: string): Promise<{ data: T; timestamp: number } | null> {
    if (!redis) return null

    try {
      const cached = await redis.get(key)
      if (cached && typeof cached === "object") {
        return cached as { data: T; timestamp: number }
      }
      return null
    } catch (error) {
      console.error("[Cache] Get error:", error)
      return null
    }
  }

  /**
   * Set cached response
   */
  static async set<T = any>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    if (!redis) return

    try {
      const ttl = options.ttl || this.DEFAULT_TTL
      const cacheData = {
        data,
        timestamp: Date.now(),
        tags: options.tags || [],
      }
      await redis.setex(key, ttl, cacheData)
    } catch (error) {
      console.error("[Cache] Set error:", error)
    }
  }

  /**
   * Invalidate cache by key pattern
   */
  static async invalidate(pattern: string): Promise<void> {
    if (!redis) return

    try {
      const keys = await redis.keys(`api:${pattern}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error("[Cache] Invalidate error:", error)
    }
  }

  /**
   * Invalidate cache by tags
   */
  static async invalidateByTags(tags: string[]): Promise<void> {
    if (!redis) return

    try {
      for (const tag of tags) {
        await this.invalidate(tag)
      }
    } catch (error) {
      console.error("[Cache] Invalidate by tags error:", error)
    }
  }

  /**
   * Create a cached API response with proper headers
   */
  static createCachedResponse<T = any>(data: T, options: CacheOptions = {}): NextResponse<T> {
    const ttl = options.ttl || this.DEFAULT_TTL
    const swr = options.staleWhileRevalidate || this.DEFAULT_SWR

    const response = NextResponse.json(data)

    // Set cache control headers
    response.headers.set("Cache-Control", `public, s-maxage=${ttl}, stale-while-revalidate=${swr}`)

    // Set ETag for conditional requests
    const etag = `"${Buffer.from(JSON.stringify(data)).toString("base64").slice(0, 27)}"`
    response.headers.set("ETag", etag)

    // Set Last-Modified
    response.headers.set("Last-Modified", new Date().toUTCString())

    return response
  }

  /**
   * Check if cached data is stale
   */
  static isStale(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp > ttl * 1000
  }
}

/**
 * Middleware helper for cached API routes
 */
export async function withCache<T = any>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<NextResponse<T>> {
  const cached = await APICache.get<T>(cacheKey)
  const ttl = options.ttl || APICache["DEFAULT_TTL"]

  // Return cached data if fresh
  if (cached && !APICache.isStale(cached.timestamp, ttl)) {
    return APICache.createCachedResponse(cached.data, options)
  }

  // Fetch fresh data
  const data = await fetcher()

  // Cache the new data
  await APICache.set(cacheKey, data, options)

  return APICache.createCachedResponse(data, options)
}

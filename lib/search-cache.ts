import { Redis } from "@upstash/redis"

let redis: Redis | null = null

try {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  // Only initialize Redis if we have valid REST API credentials (https://)
  if (url && token && url.startsWith("https://")) {
    redis = new Redis({ url, token })
  } else if (url && !url.startsWith("https://")) {
    console.warn("[SearchCache] UPSTASH_REDIS_REST_URL is not an https:// REST URL. Search caching disabled.")
  }
} catch (error) {
  console.warn("[SearchCache] Failed to initialize Redis client:", error)
}

export interface CachedSearchResult {
  notes: any[]
  totalCount: number
  timestamp: number
}

export class SearchCache {
  private static readonly CACHE_TTL = 300 // 5 minutes
  private static readonly MAX_CACHE_SIZE = 1000 // Maximum cached searches

  static getCacheKey(searchTerm: string, page = 1): string {
    return `search:${searchTerm.toLowerCase().trim()}:${page}`
  }

  static async get(searchTerm: string, page = 1): Promise<CachedSearchResult | null> {
    if (!redis) return null

    try {
      const key = this.getCacheKey(searchTerm, page)
      const cached = await redis.get(key)

      if (cached && typeof cached === "object") {
        const result = cached as CachedSearchResult
        // Check if cache is still valid (not older than TTL)
        if (Date.now() - result.timestamp < this.CACHE_TTL * 1000) {
          return result
        }
      }
      return null
    } catch (error) {
      return null
    }
  }

  static async set(searchTerm: string, result: Omit<CachedSearchResult, "timestamp">, page = 1): Promise<void> {
    if (!redis) return

    try {
      const key = this.getCacheKey(searchTerm, page)
      const cachedResult: CachedSearchResult = {
        ...result,
        timestamp: Date.now(),
      }

      await redis.setex(key, this.CACHE_TTL, cachedResult)
    } catch (error) {
      // Cache set error - fail silently
    }
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    if (!redis) return

    try {
      const keys = await redis.keys(`search:${pattern}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      // Cache invalidation error - fail silently
    }
  }
}

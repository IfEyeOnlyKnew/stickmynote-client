import { Redis } from "@upstash/redis"

let redis: Redis | null = null

try {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (url && token && url.startsWith("https://")) {
    redis = new Redis({ url, token })
  }
} catch (error) {
  console.warn("[CalstickCache] Failed to initialize Redis:", error)
}

export interface CacheResult<T> {
  data: T
  cached: boolean
  timestamp: number
}

export class CalstickCache {
  private static readonly PREFIX = "calsticks:"
  private static readonly STALE_TTL = 300 // 5 minutes for stale-while-revalidate
  private static readonly GANTT_TTL = 120 // 2 minutes for Gantt data

  /**
   * Generate cache key for user's calsticks
   */
  static getUserCacheKey(userId: string, filters: Record<string, string | number> = {}): string {
    const sortedFilters = Object.keys(filters)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => `${k}=${filters[k]}`)
      .join(":")
    return `${this.PREFIX}user:${userId}:${sortedFilters}`
  }

  /**
   * Generate cache key for Gantt chart data
   */
  static getGanttCacheKey(userId: string, padId?: string): string {
    return `${this.PREFIX}gantt:${userId}:${padId || "all"}`
  }

  /**
   * Generate cache key for dependencies
   */
  static getDependenciesCacheKey(taskIds: string[]): string {
    const sortedIds = [...taskIds].sort((a, b) => a.localeCompare(b)).join(",")
    const hash = Buffer.from(sortedIds).toString("base64").slice(0, 16)
    return `${this.PREFIX}deps:${hash}`
  }

  /**
   * Generate cache key for critical path calculation
   */
  static getCriticalPathCacheKey(taskIds: string[]): string {
    const sortedIds = [...taskIds].sort((a, b) => a.localeCompare(b)).join(",")
    const hash = Buffer.from(sortedIds).toString("base64").slice(0, 16)
    return `${this.PREFIX}critpath:${hash}`
  }

  /**
   * Get cached data with stale-while-revalidate support
   */
  static async get<T>(key: string): Promise<CacheResult<T> | null> {
    if (!redis) return null

    try {
      const cached = await redis.get<{ data: T; timestamp: number }>(key)
      if (cached) {
        return {
          data: cached.data,
          cached: true,
          timestamp: cached.timestamp,
        }
      }
      return null
    } catch (error) {
      console.error("[CalstickCache] Get error:", error)
      return null
    }
  }

  /**
   * Set data in cache
   */
  static async set<T>(key: string, data: T, ttl: number = this.STALE_TTL): Promise<void> {
    if (!redis) return

    try {
      await redis.setex(key, ttl, {
        data,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error("[CalstickCache] Set error:", error)
    }
  }

  /**
   * Cache Gantt chart data with optimized TTL
   */
  static async setGanttData<T>(userId: string, padId: string | undefined, data: T): Promise<void> {
    const key = this.getGanttCacheKey(userId, padId)
    await this.set(key, data, this.GANTT_TTL)
  }

  /**
   * Get cached Gantt chart data
   */
  static async getGanttData<T>(userId: string, padId?: string): Promise<CacheResult<T> | null> {
    const key = this.getGanttCacheKey(userId, padId)
    return this.get<T>(key)
  }

  /**
   * Cache critical path calculation
   */
  static async setCriticalPath(taskIds: string[], criticalTaskIds: string[]): Promise<void> {
    const key = this.getCriticalPathCacheKey(taskIds)
    await this.set(key, criticalTaskIds, this.GANTT_TTL)
  }

  /**
   * Get cached critical path
   */
  static async getCriticalPath(taskIds: string[]): Promise<string[] | null> {
    const key = this.getCriticalPathCacheKey(taskIds)
    const result = await this.get<string[]>(key)
    return result?.data || null
  }

  /**
   * Invalidate user's calstick cache
   */
  static async invalidateUser(userId: string): Promise<void> {
    if (!redis) return

    try {
      const keys = await redis.keys(`${this.PREFIX}user:${userId}:*`)
      const ganttKeys = await redis.keys(`${this.PREFIX}gantt:${userId}:*`)
      const allKeys = [...keys, ...ganttKeys]
      if (allKeys.length > 0) {
        await redis.del(...allKeys)
      }
    } catch (error) {
      console.error("[CalstickCache] Invalidate user error:", error)
    }
  }

  /**
   * Invalidate all dependencies cache
   */
  static async invalidateDependencies(): Promise<void> {
    if (!redis) return

    try {
      const keys = await redis.keys(`${this.PREFIX}deps:*`)
      const critPathKeys = await redis.keys(`${this.PREFIX}critpath:*`)
      const allKeys = [...keys, ...critPathKeys]
      if (allKeys.length > 0) {
        await redis.del(...allKeys)
      }
    } catch (error) {
      console.error("[CalstickCache] Invalidate deps error:", error)
    }
  }

  /**
   * Check if Redis is available
   */
  static isAvailable(): boolean {
    return redis !== null
  }

  /**
   * Get cache stats for monitoring
   */
  static async getStats(): Promise<{
    available: boolean
    keyCount: number
    ganttCacheCount: number
    depsCacheCount: number
  }> {
    if (!redis) return { available: false, keyCount: 0, ganttCacheCount: 0, depsCacheCount: 0 }

    try {
      const allKeys = await redis.keys(`${this.PREFIX}*`)
      const ganttKeys = await redis.keys(`${this.PREFIX}gantt:*`)
      const depsKeys = await redis.keys(`${this.PREFIX}deps:*`)
      return {
        available: true,
        keyCount: allKeys.length,
        ganttCacheCount: ganttKeys.length,
        depsCacheCount: depsKeys.length,
      }
    } catch {
      return { available: false, keyCount: 0, ganttCacheCount: 0, depsCacheCount: 0 }
    }
  }

  /**
   * Batch get multiple cache keys
   */
  static async mget<T>(keys: string[]): Promise<Map<string, T>> {
    if (!redis || keys.length === 0) return new Map()

    try {
      const results = await redis.mget(...keys)
      const map = new Map<string, T>()
      keys.forEach((key, index) => {
        const value = results[index] as { data: T; timestamp: number } | null
        if (value) {
          map.set(key, value.data)
        }
      })
      return map
    } catch (error) {
      console.error("[CalstickCache] MGet error:", error)
      return new Map()
    }
  }
}

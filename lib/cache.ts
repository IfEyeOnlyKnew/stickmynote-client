// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

class Cache {
  private cache = new Map<string, CacheItem<any>>()
  private maxSize = 1000
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start cleanup interval
    this.startCleanup()
  }

  /**
   * Set a value in the cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)

    if (!item) {
      return null
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const item = this.cache.get(key)

    if (!item) {
      return false
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number
    maxSize: number
    keys: string[]
    oldestTimestamp: number | null
    newestTimestamp: number | null
  } {
    const keys = Array.from(this.cache.keys())
    const timestamps = Array.from(this.cache.values()).map((item) => item.timestamp)

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys,
      oldestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let deletedCount = 0
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * Get or set a value (with callback for miss)
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl: number = 5 * 60 * 1000): Promise<T> {
    const cached = this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    const data = await factory()
    this.set(key, data, ttl)
    return data
  }

  /**
   * Batch get multiple keys
   */
  getBatch<T>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {}

    for (const key of keys) {
      result[key] = this.get<T>(key)
    }

    return result
  }

  /**
   * Batch set multiple keys
   */
  setBatch<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.data, entry.ttl)
    }
  }

  /**
   * Batch delete multiple keys
   */
  deleteBatch(keys: string[]): number {
    let deletedCount = 0

    for (const key of keys) {
      if (this.cache.delete(key)) {
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * Get all keys matching a pattern
   */
  getKeysByPattern(pattern: string): string[] {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))
    return Array.from(this.cache.keys()).filter((key) => regex.test(key))
  }

  /**
   * Refresh TTL for a key
   */
  touch(key: string, ttl?: number): boolean {
    const item = this.cache.get(key)

    if (!item) {
      return false
    }

    item.timestamp = Date.now()
    if (ttl !== undefined) {
      item.ttl = ttl
    }

    return true
  }

  /**
   * Get remaining TTL for a key
   */
  getTTL(key: string): number | null {
    const item = this.cache.get(key)

    if (!item) {
      return null
    }

    const elapsed = Date.now() - item.timestamp
    const remaining = item.ttl - elapsed

    return remaining > 0 ? remaining : 0
  }

  /**
   * Start automatic cleanup of expired items
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000) // Cleanup every minute
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Manual cleanup of expired items
   */
  cleanup(): number {
    let deletedCount = 0
    const now = Date.now()

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * Evict oldest items when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTimestamp = Number.POSITIVE_INFINITY

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Destroy the cache instance
   */
  destroy(): void {
    this.stopCleanup()
    this.clear()
  }
}

// ============================================================================
// SINGLETON CACHE INSTANCE
// ============================================================================

export const cache = new Cache()

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get cached data
 */
export function getCachedData<T>(key: string): T | null {
  return cache.get<T>(key)
}

/**
 * Set cached data
 */
export function setCachedData<T>(key: string, data: T, ttl?: number): void {
  cache.set(key, data, ttl)
}

/**
 * Delete cached data
 */
export function deleteCachedData(key: string): boolean {
  return cache.delete(key)
}

/**
 * Invalidate cache pattern
 */
export function invalidateCache(pattern: string): number {
  return cache.invalidatePattern(pattern)
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return cache.stats()
}

// ============================================================================
// EXPORTS
// ============================================================================

export default cache

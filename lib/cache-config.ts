// Cache configuration and utilities for Next.js data caching
import { unstable_cache } from "next/cache"
import { revalidateTag } from "next/cache"

/**
 * Cache tags for different data types
 * Used for granular cache invalidation
 */
export const CACHE_TAGS = {
  notes: (userId: string) => `notes-${userId}`,
  noteStats: (userId: string) => `note-stats-${userId}`,
  pads: (userId: string) => `pads-${userId}`,
  sticks: (userId: string) => `sticks-${userId}`,
  pad: (padId: string) => `pad-${padId}`,
  stick: (stickId: string) => `stick-${stickId}`,
} as const

/**
 * Cache durations in seconds
 */
export const CACHE_DURATIONS = {
  notes: 60, // 1 minute - frequently updated
  noteStats: 300, // 5 minutes - aggregated data
  pads: 300, // 5 minutes - less frequently updated
  sticks: 60, // 1 minute - frequently updated
  pad: 300, // 5 minutes
  stick: 60, // 1 minute
} as const

/**
 * Invalidate cache for a specific user's notes
 */
export async function invalidateNotesCache(userId: string) {
  revalidateTag(CACHE_TAGS.notes(userId))
  revalidateTag(CACHE_TAGS.noteStats(userId))
}

/**
 * Invalidate cache for a specific user's pads
 */
export async function invalidatePadsCache(userId: string) {
  revalidateTag(CACHE_TAGS.pads(userId))
}

/**
 * Invalidate cache for a specific user's sticks
 */
export async function invalidateSticksCache(userId: string) {
  revalidateTag(CACHE_TAGS.sticks(userId))
}

/**
 * Invalidate cache for a specific pad
 */
export async function invalidatePadCache(padId: string) {
  revalidateTag(CACHE_TAGS.pad(padId))
}

/**
 * Invalidate cache for a specific stick
 */
export async function invalidateStickCache(stickId: string) {
  revalidateTag(CACHE_TAGS.stick(stickId))
}

/**
 * Create a cached function with proper typing
 */
export function createCachedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    tags: string[]
    revalidate: number
  },
): T {
  return unstable_cache(fn, undefined, {
    tags: options.tags,
    revalidate: options.revalidate,
  }) as T
}

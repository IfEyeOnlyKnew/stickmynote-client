import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export interface CachedAuthUser {
  id: string
  email?: string
}

export interface CachedAuthResult {
  user: CachedAuthUser | null
  userId: string | null // Alias for user?.id for backwards compatibility
  error: "rate_limited" | "auth_error" | null
  rateLimited: boolean
}

interface AuthCacheEntry {
  user: CachedAuthUser
  timestamp: number
}

// In-memory cache for auth results to reduce Supabase auth endpoint calls
const authCache = new Map<string, AuthCacheEntry>()
const CACHE_TTL = 30000 // 30 seconds
const MAX_CACHE_SIZE = 1000

// Stale cache for fallback during rate limiting (longer TTL)
const staleCache = new Map<string, AuthCacheEntry>()
const STALE_CACHE_TTL = 300000 // 5 minutes

function getCacheKey(cookieHeader: string | null): string {
  // Use a hash of relevant auth cookies as cache key
  return cookieHeader ? `auth:${cookieHeader.slice(0, 100)}` : "auth:anonymous"
}

function cleanupCache() {
  const now = Date.now()

  // Clean main cache
  if (authCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(authCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2))
    toRemove.forEach(([key]) => authCache.delete(key))
  }

  // Remove expired entries from main cache
  for (const [key, entry] of authCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      authCache.delete(key)
    }
  }

  // Clean stale cache
  for (const [key, entry] of staleCache.entries()) {
    if (now - entry.timestamp > STALE_CACHE_TTL) {
      staleCache.delete(key)
    }
  }
}

/**
 * Get authenticated user with caching to reduce Supabase auth endpoint calls.
 * This prevents rate limiting errors when multiple API calls happen quickly.
 *
 * @param supabaseClient - Optional: Pass an existing supabase client to reuse, otherwise one will be created
 *
 * Returns:
 * - { user, error: null, rateLimited: false } - Successfully authenticated user
 * - { user: null, error: null, rateLimited: false } - Not authenticated (no session)
 * - { user: null, error: "rate_limited", rateLimited: true } - Rate limited with no stale cache
 * - { user, error: "rate_limited", rateLimited: true } - Rate limited but using stale cache
 */
export async function getCachedAuthUser(supabaseClient?: SupabaseClient): Promise<CachedAuthResult> {
  try {
    const cookieStore = await cookies()
    const cacheKey = getCacheKey(cookieStore.toString())
    const now = Date.now()

    // Check fresh cache first
    const cached = authCache.get(cacheKey)
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return { user: cached.user, userId: cached.user.id, error: null, rateLimited: false }
    }

    // Cache miss or expired - fetch from Supabase
    const supabase = supabaseClient || (await createClient())

    let authResult
    try {
      authResult = await supabase.auth.getUser()
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)

      // Check for rate limiting
      if (errorMessage.includes("Too Many") || errorMessage.includes("429")) {
        console.error("[SERVER] getCachedAuthUser: Rate limited during auth fetch")

        // Try stale cache as fallback
        const stale = staleCache.get(cacheKey)
        if (stale && now - stale.timestamp < STALE_CACHE_TTL) {
          console.log("[SERVER] getCachedAuthUser: Using stale cache during rate limit")
          return { user: stale.user, userId: stale.user.id, error: "rate_limited", rateLimited: true }
        }

        return { user: null, userId: null, error: "rate_limited", rateLimited: true }
      }

      console.error("[SERVER] getCachedAuthUser: Fetch error:", errorMessage)
      return { user: null, userId: null, error: "auth_error", rateLimited: false }
    }

    const {
      data: { user },
      error: authError,
    } = authResult

    if (authError) {
      const errorMessage = authError.message || String(authError)

      // Check for rate limiting in error response
      if (errorMessage.includes("Too Many") || errorMessage.includes("429")) {
        console.error("[SERVER] getCachedAuthUser: Rate limited")

        // Try stale cache as fallback
        const stale = staleCache.get(cacheKey)
        if (stale && now - stale.timestamp < STALE_CACHE_TTL) {
          console.log("[SERVER] getCachedAuthUser: Using stale cache during rate limit")
          return { user: stale.user, userId: stale.user.id, error: "rate_limited", rateLimited: true }
        }

        return { user: null, userId: null, error: "rate_limited", rateLimited: true }
      }

      return { user: null, userId: null, error: "auth_error", rateLimited: false }
    }

    if (!user) {
      return { user: null, userId: null, error: null, rateLimited: false }
    }

    // Update caches
    const cacheEntry: AuthCacheEntry = {
      user: { id: user.id, email: user.email },
      timestamp: now,
    }

    cleanupCache()
    authCache.set(cacheKey, cacheEntry)
    staleCache.set(cacheKey, cacheEntry)

    return { user: { id: user.id, email: user.email }, userId: user.id, error: null, rateLimited: false }
  } catch (err) {
    console.error("[SERVER] getCachedAuthUser: Unexpected error", err)
    return { user: null, userId: null, error: "auth_error", rateLimited: false }
  }
}

/**
 * Helper to create a rate limit JSON response
 */
export function createRateLimitResponse(message = "Too many requests. Please try again in a moment.") {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: { "Retry-After": "30" },
    },
  )
}

/**
 * Helper to create an unauthorized JSON response
 */
export function createUnauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Create a singleton server client with service role for rate limiting
let serverClient: ReturnType<typeof createClient<Database>> | null = null

function getServerClient() {
  if (serverClient) return serverClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables for rate limiter")
  }

  serverClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serverClient
}

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
  const supabase = getServerClient()
  const config = rateLimitConfigs[action] || rateLimitConfigs.general
  const now = Date.now()
  const windowStart = now - config.windowMs

  // Use userId as primary identifier, IP as fallback
  const identifier = userId || ip || "anonymous"
  const key = `${action}:${identifier}`

  try {
    // Clean up old entries
    await supabase.from("rate_limits").delete().lt("created_at", new Date(windowStart).toISOString())

    // Count current requests in window
    const { data: requests, error } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("key", key)
      .gte("created_at", new Date(windowStart).toISOString())

    if (error) {
      console.error("Rate limit check error:", error)
      // Allow request if we can't check (fail open)
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      }
    }

    const currentCount = requests?.length || 0

    if (currentCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + config.windowMs,
      }
    }

    // Record this request
    await supabase.from("rate_limits").insert({
      key,
      user_id: userId,
      ip_address: ip,
      action,
      created_at: new Date().toISOString(),
    } as any)

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

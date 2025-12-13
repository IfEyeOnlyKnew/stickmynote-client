// Production health check utilities
import { createClient } from "@/lib/supabase/client"

export interface HealthCheckResult {
  service: string
  status: "healthy" | "unhealthy" | "degraded"
  responseTime?: number
  error?: string
  details?: Record<string, any>
}

export interface SystemHealth {
  overall: "healthy" | "unhealthy" | "degraded"
  checks: HealthCheckResult[]
  timestamp: string
}

/**
 * Check Supabase database connectivity
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now()

  try {
    const supabase = createClient()
    if (!supabase) {
      return {
        service: "database",
        status: "unhealthy",
        error: "Supabase client not initialized",
      }
    }

    // Test basic connectivity
    const { data, error } = await supabase.from("users").select("id").limit(1).single()

    const responseTime = Date.now() - start

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      return {
        service: "database",
        status: "unhealthy",
        responseTime,
        error: error.message,
      }
    }

    return {
      service: "database",
      status: responseTime > 1000 ? "degraded" : "healthy",
      responseTime,
      details: {
        connected: true,
        queryTime: responseTime,
      },
    }
  } catch (error) {
    return {
      service: "database",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check authentication service
 */
export async function checkAuthHealth(): Promise<HealthCheckResult> {
  const start = Date.now()

  try {
    const supabase = createClient()
    if (!supabase) {
      return {
        service: "auth",
        status: "unhealthy",
        error: "Supabase client not initialized",
      }
    }

    const { data, error } = await supabase.auth.getUser()
    const responseTime = Date.now() - start

    if (error) {
      return {
        service: "auth",
        status: "unhealthy",
        responseTime,
        error: error.message,
      }
    }

    return {
      service: "auth",
      status: responseTime > 500 ? "degraded" : "healthy",
      responseTime,
      details: {
        userCheck: true,
        responseTime,
      },
    }
  } catch (error) {
    return {
      service: "auth",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check Redis/KV store connectivity
 */
export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const start = Date.now()

  try {
    // Test Redis connectivity if available
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      })

      const responseTime = Date.now() - start

      if (!response.ok) {
        return {
          service: "redis",
          status: "unhealthy",
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return {
        service: "redis",
        status: responseTime > 200 ? "degraded" : "healthy",
        responseTime,
        details: {
          ping: true,
          responseTime,
        },
      }
    }

    return {
      service: "redis",
      status: "healthy",
      responseTime: Date.now() - start,
      details: {
        configured: false,
        fallback: "memory",
      },
    }
  } catch (error) {
    return {
      service: "redis",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check external API integrations
 */
export async function checkExternalAPIsHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  const checks: Record<string, boolean> = {}

  try {
    // Check Grok AI if configured
    if (process.env.XAI_API_KEY) {
      try {
        const response = await fetch("https://api.x.ai/v1/models", {
          headers: {
            Authorization: `Bearer ${process.env.XAI_API_KEY}`,
          },
        })
        checks.grok = response.ok
      } catch {
        checks.grok = false
      }
    }

    // Check Resend if configured
    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/domains", {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
        })
        checks.resend = response.ok
      } catch {
        checks.resend = false
      }
    }

    const responseTime = Date.now() - start
    const failedChecks = Object.entries(checks).filter(([, status]) => !status)

    return {
      service: "external_apis",
      status:
        failedChecks.length === 0
          ? "healthy"
          : failedChecks.length < Object.keys(checks).length
            ? "degraded"
            : "unhealthy",
      responseTime,
      details: {
        checks,
        failed: failedChecks.map(([name]) => name),
      },
    }
  } catch (error) {
    return {
      service: "external_apis",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Perform comprehensive system health check
 */
export async function performHealthCheck(): Promise<SystemHealth> {
  const checks = await Promise.all([
    checkDatabaseHealth(),
    checkAuthHealth(),
    checkRedisHealth(),
    checkExternalAPIsHealth(),
  ])

  const unhealthyCount = checks.filter((check) => check.status === "unhealthy").length
  const degradedCount = checks.filter((check) => check.status === "degraded").length

  let overall: "healthy" | "unhealthy" | "degraded"
  if (unhealthyCount > 0) {
    overall = "unhealthy"
  } else if (degradedCount > 0) {
    overall = "degraded"
  } else {
    overall = "healthy"
  }

  return {
    overall,
    checks,
    timestamp: new Date().toISOString(),
  }
}

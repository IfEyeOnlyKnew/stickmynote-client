"use client"

import { useState } from "react"

export type Check = {
  name: string
  status: "success" | "error" | "warning"
  message: string
  details?: any
}

export type CheckCategory = {
  name: string
  checks: Check[]
}

export function useProductionChecks() {
  const [results, setResults] = useState<Check[]>([])
  const [running, setRunning] = useState(false)

  const runEnvironmentChecks = async (): Promise<Check[]> => {
    const checks: Check[] = []

    try {
      const response = await fetch("/api/debug-env", { cache: "no-store" })
      const data = await response.json()

      checks.push({
        name: "Environment: Database",
        status: data?.hasDatabaseUrl || data?.hasPostgresHost ? "success" : "error",
        message:
          data?.hasDatabaseUrl || data?.hasPostgresHost
            ? "Database env vars found"
            : "Missing database connection env vars",
        details: {
          hasDatabaseUrl: data?.hasDatabaseUrl,
          hasPostgresHost: data?.hasPostgresHost,
          nodeEnv: data?.nodeEnv,
        },
      })

      return checks
    } catch (error) {
      return [
        {
          name: "Environment",
          status: "warning",
          message: "Could not read /api/debug-env",
          details: String(error),
        },
      ]
    }
  }

  const runSEOChecks = async (): Promise<Check[]> => {
    const checks: Check[] = []

    try {
      const [robots, sitemap] = await Promise.all([
        fetch("/robots.txt", { cache: "no-store" }),
        fetch("/sitemap.xml", { cache: "no-store" }),
      ])

      checks.push({
        name: "SEO: robots.txt",
        status: robots.ok ? "success" : "error",
        message: robots.ok ? "robots.txt served" : "robots.txt not available",
        details: { status: robots.status },
      })

      checks.push({
        name: "SEO: sitemap.xml",
        status: sitemap.ok ? "success" : "error",
        message: sitemap.ok ? "sitemap.xml served" : "sitemap.xml not available",
        details: { status: sitemap.status },
      })

      return checks
    } catch (error) {
      return [
        {
          name: "SEO: endpoints",
          status: "error",
          message: "Failed to query SEO endpoints",
          details: String(error),
        },
      ]
    }
  }

  const runSecurityChecks = async (): Promise<Check[]> => {
    const checks: Check[] = []

    try {
      const response = await fetch("/api/rate-limit-health", { cache: "no-store" })
      const data = await response.json()

      checks.push({
        name: "Rate Limiter",
        status: response.ok && (data.redis || data.fallback) ? "success" : "warning",
        message: response.ok ? "Rate limiter operational" : "Rate limiter endpoint failed",
        details: data,
      })

      return checks
    } catch (error) {
      return [
        {
          name: "Rate Limiter",
          status: "warning",
          message: "Rate limiter check failed",
          details: String(error),
        },
      ]
    }
  }

  const runDatabaseChecks = async (): Promise<Check[]> => {
    const checks: Check[] = []

    try {
      const response = await fetch("/api/database-health", { cache: "no-store" })
      const data = await response.json()

      checks.push({
        name: "Database Health",
        status: response.ok && data.ok ? "success" : response.ok ? "warning" : "error",
        message: data.ok ? "Database connectivity looks good" : "DB health returned warnings",
        details: data,
      })

      return checks
    } catch (error) {
      return [
        {
          name: "Database Health",
          status: "warning",
          message: "Database health check failed",
          details: String(error),
        },
      ]
    }
  }

  const runAIChecks = async (): Promise<Check[]> => {
    const checks: Check[] = []
    let hasXaiKey = false
    let hasAiFallback = true

    try {
      // Get AI configuration
      const envResponse = await fetch("/api/debug-env", { cache: "no-store" })
      const envData = await envResponse.json()
      hasXaiKey = !!envData?.hasXaiKey
      hasAiFallback = !!envData?.hasAiFallback

      // Test AI tag generation
      const response = await fetch("/api/generate-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          topic: "Search Tips",
          content: "How to find authoritative references efficiently",
        }),
      })

      const data = await response.json()
      const ok = response.ok && Array.isArray(data?.tags) && data.tags.length > 0
      const usedFallback = data?.source === "fallback"

      const status: Check["status"] = ok ? "success" : "warning"
      const message = ok
        ? usedFallback && !hasXaiKey && hasAiFallback
          ? "Tags API succeeded via fallback (XAI optional)"
          : "Tags API returned tags"
        : "Tags API failed"

      checks.push({
        name: "AI: Generate Tags",
        status,
        message,
        details: data,
      })

      // XAI key check
      if (!hasXaiKey && usedFallback && ok) {
        checks.push({
          name: "Environment: XAI_API_KEY",
          status: "success",
          message: "XAI key not set, but AI fallback is active and healthy",
          details: { hasXaiKey, hasAiFallback },
        })
      } else {
        checks.push({
          name: "Environment: XAI_API_KEY",
          status: hasXaiKey ? "success" : "warning",
          message: hasXaiKey ? "XAI key configured" : "XAI key missing (fallback available)",
          details: { hasXaiKey, hasAiFallback },
        })
      }

      return checks
    } catch (error) {
      return [
        {
          name: "AI: Generate Tags",
          status: "warning",
          message: "Tags API request failed",
          details: String(error),
        },
      ]
    }
  }

  const runAllChecks = async () => {
    setRunning(true)

    try {
      const [envChecks, seoChecks, securityChecks, dbChecks, aiChecks] = await Promise.all([
        runEnvironmentChecks(),
        runSEOChecks(),
        runSecurityChecks(),
        runDatabaseChecks(),
        runAIChecks(),
      ])

      const allChecks = [...envChecks, ...seoChecks, ...securityChecks, ...dbChecks, ...aiChecks]
      setResults(allChecks)
    } catch (error) {
      console.error("Failed to run production checks:", error)
    } finally {
      setRunning(false)
    }
  }

  const getChecksByCategory = (): CheckCategory[] => {
    const categories: CheckCategory[] = [
      { name: "Environment", checks: results.filter((c) => c.name.startsWith("Environment")) },
      { name: "SEO", checks: results.filter((c) => c.name.startsWith("SEO")) },
      { name: "Security", checks: results.filter((c) => c.name.includes("Rate Limiter")) },
      { name: "Database", checks: results.filter((c) => c.name.includes("Database")) },
      { name: "AI Services", checks: results.filter((c) => c.name.startsWith("AI")) },
    ]

    return categories.filter((cat) => cat.checks.length > 0)
  }

  return {
    results,
    running,
    runAllChecks,
    getChecksByCategory,
  }
}

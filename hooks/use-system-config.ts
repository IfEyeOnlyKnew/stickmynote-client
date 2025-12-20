"use client"

import { useState } from "react"

export interface ConfigCheck {
  name: string
  status: "success" | "error" | "warning"
  message: string
  details?: any
}

export function useSystemConfig() {
  const [checks, setChecks] = useState<ConfigCheck[]>([])
  const [loading, setLoading] = useState(false)

  const runAllChecks = async () => {
    setLoading(true)
    setChecks([])

    const configChecks: ConfigCheck[] = []

    try {
      console.log("🔧 Running system health checks...")
      
      const response = await fetch("/api/system/health")
      const data = await response.json()

      if (data.checks) {
        // Convert health check response to ConfigCheck format
        if (data.checks.database) {
          configChecks.push({
            name: "Database Connection",
            status: data.checks.database.status,
            message: data.checks.database.message,
            details: data.checks.database.details
          })
        }

        if (data.checks.auth) {
          configChecks.push({
            name: "Authentication System",
            status: data.checks.auth.status,
            message: data.checks.auth.message,
            details: data.checks.auth.details
          })
        }

        if (data.checks.environment) {
          configChecks.push({
            name: "Environment Variables",
            status: data.checks.environment.status,
            message: data.checks.environment.message,
            details: data.checks.environment.details
          })
        }

        if (data.checks.email) {
          configChecks.push({
            name: "Email Configuration",
            status: data.checks.email.status,
            message: data.checks.email.message,
            details: data.checks.email.details
          })
        }
      }

      // Add overall status
      configChecks.push({
        name: "Overall Status",
        status: data.status === "healthy" ? "success" : data.status === "degraded" ? "warning" : "error",
        message: `System is ${data.status}`,
        details: { timestamp: data.timestamp }
      })

    } catch (error: any) {
      configChecks.push({
        name: "Health Check",
        status: "error",
        message: "Failed to run health checks",
        details: { error: error.message }
      })
    }

    setChecks(configChecks)
    setLoading(false)
  }

  return {
    checks,
    loading,
    runAllChecks,
  }
}

// Backward compatibility alias
export const useSupabaseConfig = useSystemConfig
